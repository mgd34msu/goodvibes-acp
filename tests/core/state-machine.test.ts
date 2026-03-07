import { describe, it, expect, beforeEach } from 'bun:test';
import { StateMachine } from '../../src/core/state-machine.ts';
import type { StateMachineConfig } from '../../src/core/state-machine.ts';

type SimpleState = 'idle' | 'working' | 'done' | 'failed';
interface SimpleContext { attempts: number; allowed: boolean }

function makeConfig(
  overrides: Partial<StateMachineConfig<SimpleState, SimpleContext>> = {}
): StateMachineConfig<SimpleState, SimpleContext> {
  return {
    initial: 'idle',
    states: {
      idle: {},
      working: {},
      done: {},
      failed: {},
    },
    transitions: [
      { from: 'idle', to: 'working', event: 'start' },
      { from: 'working', to: 'done', event: 'finish' },
      { from: 'working', to: 'failed', event: 'fail' },
      { from: ['idle', 'failed'], to: 'idle', event: 'reset' },
    ],
    context: { attempts: 0, allowed: true },
    ...overrides,
  };
}

describe('StateMachine', () => {
  let machine: StateMachine<SimpleState, SimpleContext>;

  beforeEach(() => {
    machine = new StateMachine(makeConfig());
  });

  // --- Basic transitions ---

  describe('transition', () => {
    it('returns true for valid transition', () => {
      expect(machine.transition('start')).toBe(true);
    });

    it('returns false for invalid transition (wrong state)', () => {
      expect(machine.transition('finish')).toBe(false);
    });

    it('returns false for unknown event', () => {
      expect(machine.transition('nonexistent')).toBe(false);
    });

    it('changes current state after valid transition', () => {
      machine.transition('start');
      expect(machine.current()).toBe('working');
    });

    it('does not change state on invalid transition', () => {
      machine.transition('finish'); // invalid from idle
      expect(machine.current()).toBe('idle');
    });

    it('supports chained transitions', () => {
      machine.transition('start');
      machine.transition('finish');
      expect(machine.current()).toBe('done');
    });
  });

  // --- Array from ---

  describe('array from in transitions', () => {
    it('transitions from first matching state in array', () => {
      // 'reset' is valid from both 'idle' and 'failed'
      machine.transition('reset'); // from idle -> idle
      expect(machine.current()).toBe('idle');
    });

    it('transitions from second matching state in array', () => {
      machine.transition('start');
      machine.transition('fail');
      expect(machine.current()).toBe('failed');
      machine.transition('reset'); // from failed -> idle
      expect(machine.current()).toBe('idle');
    });

    it('does not transition from non-listed state', () => {
      machine.transition('start'); // now working
      expect(machine.transition('reset')).toBe(false); // 'working' not in ['idle','failed']
    });
  });

  // --- can ---

  describe('can', () => {
    it('returns true for valid event in current state', () => {
      expect(machine.can('start')).toBe(true);
    });

    it('returns false for event not valid from current state', () => {
      expect(machine.can('finish')).toBe(false);
    });

    it('does not fire guards', () => {
      const m = new StateMachine(makeConfig({
        transitions: [
          { from: 'idle', to: 'working', event: 'start', guard: () => false },
        ],
      }));
      // can() returns true even though guard would block transition
      expect(m.can('start')).toBe(true);
    });
  });

  // --- Guard conditions ---

  describe('guard conditions', () => {
    it('guard returning false blocks transition', () => {
      const m = new StateMachine(makeConfig({
        transitions: [
          { from: 'idle', to: 'working', event: 'start', guard: (ctx) => ctx.allowed },
        ],
        context: { attempts: 0, allowed: false },
      }));
      expect(m.transition('start')).toBe(false);
      expect(m.current()).toBe('idle');
    });

    it('guard returning true allows transition', () => {
      const m = new StateMachine(makeConfig({
        transitions: [
          { from: 'idle', to: 'working', event: 'start', guard: (ctx) => ctx.allowed },
        ],
        context: { attempts: 0, allowed: true },
      }));
      expect(m.transition('start')).toBe(true);
      expect(m.current()).toBe('working');
    });

    it('skips guarded transition and tries next matching transition', () => {
      // Two transitions for same event from same state — first guarded, second not
      const m = new StateMachine<SimpleState, SimpleContext>({
        initial: 'idle',
        states: {},
        transitions: [
          { from: 'idle', to: 'failed', event: 'go', guard: () => false },
          { from: 'idle', to: 'working', event: 'go' },
        ],
        context: { attempts: 0, allowed: true },
      });
      m.transition('go');
      expect(m.current()).toBe('working');
    });
  });

  // --- onEnter / onExit hooks (StateConfig) ---

  describe('onEnter / onExit hooks (StateConfig)', () => {
    it('onEnter fires when entering state', () => {
      const calls: string[] = [];
      const m = new StateMachine(makeConfig({
        states: {
          idle: {},
          working: { onEnter: (ctx, from) => { calls.push(`enter:working from:${from}`); } },
          done: {},
          failed: {},
        },
      }));
      m.transition('start');
      expect(calls).toEqual(['enter:working from:idle']);
    });

    it('onExit fires when leaving state', () => {
      const calls: string[] = [];
      const m = new StateMachine(makeConfig({
        states: {
          idle: { onExit: (ctx, to) => { calls.push(`exit:idle to:${to}`); } },
          working: {},
          done: {},
          failed: {},
        },
      }));
      m.transition('start');
      expect(calls).toEqual(['exit:idle to:working']);
    });

    it('errors in onEnter are swallowed and transition still succeeds', () => {
      const m = new StateMachine(makeConfig({
        states: {
          idle: {},
          working: { onEnter: () => { throw new Error('hook error'); } },
          done: {},
          failed: {},
        },
      }));
      expect(() => m.transition('start')).not.toThrow();
      expect(m.current()).toBe('working');
    });
  });

  // --- onEnter / onExit listeners ---

  describe('onEnter / onExit listeners', () => {
    it('onEnter listener fires when entering target state', () => {
      const calls: string[] = [];
      machine.onEnter('working', (from) => calls.push(`from:${from}`));
      machine.transition('start');
      expect(calls).toEqual(['from:idle']);
    });

    it('onEnter listener does not fire for other state entries', () => {
      const calls: string[] = [];
      machine.onEnter('done', (from) => calls.push(from));
      machine.transition('start');
      expect(calls).toHaveLength(0);
    });

    it('onExit listener fires when leaving target state', () => {
      const calls: string[] = [];
      machine.onExit('idle', (to) => calls.push(`to:${to}`));
      machine.transition('start');
      expect(calls).toEqual(['to:working']);
    });

    it('dispose() on onEnter removes listener', () => {
      const calls: string[] = [];
      const sub = machine.onEnter('working', () => calls.push('enter'));
      sub.dispose();
      machine.transition('start');
      expect(calls).toHaveLength(0);
    });

    it('dispose() on onExit removes listener', () => {
      const calls: string[] = [];
      const sub = machine.onExit('idle', () => calls.push('exit'));
      sub.dispose();
      machine.transition('start');
      expect(calls).toHaveLength(0);
    });
  });

  // --- onTransition ---

  describe('onTransition', () => {
    it('fires on every successful transition', () => {
      const records: { from: string; to: string; event: string }[] = [];
      machine.onTransition((rec) => records.push({ from: rec.from, to: rec.to, event: rec.event }));
      machine.transition('start');
      machine.transition('finish');
      expect(records).toHaveLength(2);
      expect(records[0]).toMatchObject({ from: 'idle', to: 'working', event: 'start' });
      expect(records[1]).toMatchObject({ from: 'working', to: 'done', event: 'finish' });
    });

    it('does not fire on invalid transition', () => {
      const calls: number[] = [];
      machine.onTransition(() => calls.push(1));
      machine.transition('nonexistent');
      expect(calls).toHaveLength(0);
    });

    it('dispose() removes the transition handler', () => {
      const calls: number[] = [];
      const sub = machine.onTransition(() => calls.push(1));
      sub.dispose();
      machine.transition('start');
      expect(calls).toHaveLength(0);
    });

    it('receives current context at time of transition', () => {
      let capturedCtx: SimpleContext | undefined;
      machine.onTransition((_, ctx) => { capturedCtx = ctx; });
      machine.updateContext((c) => ({ ...c, attempts: 5 }));
      machine.transition('start');
      expect(capturedCtx?.attempts).toBe(5);
    });
  });

  // --- context ---

  describe('context', () => {
    it('returns initial context', () => {
      expect(machine.context()).toEqual({ attempts: 0, allowed: true });
    });

    it('updateContext replaces context via updater', () => {
      machine.updateContext((c) => ({ ...c, attempts: 3 }));
      expect(machine.context().attempts).toBe(3);
    });

    it('context is independent copy of initial config (shallow)', () => {
      const original = { attempts: 0, allowed: true };
      const m = new StateMachine(makeConfig({ context: original }));
      original.attempts = 99;
      expect(m.context().attempts).toBe(0);
    });
  });

  // --- history ---

  describe('history', () => {
    it('starts with empty history', () => {
      expect(machine.history()).toHaveLength(0);
    });

    it('records transitions in order', () => {
      machine.transition('start');
      machine.transition('finish');
      const h = machine.history();
      expect(h).toHaveLength(2);
      expect(h[0]).toMatchObject({ from: 'idle', to: 'working', event: 'start' });
      expect(h[1]).toMatchObject({ from: 'working', to: 'done', event: 'finish' });
    });

    it('history records include timestamps', () => {
      machine.transition('start');
      expect(typeof machine.history()[0].timestamp).toBe('number');
    });

    it('respects historyLimit', () => {
      const m = new StateMachine<'a' | 'b', Record<never, never>>({
        initial: 'a',
        states: { a: {}, b: {} },
        transitions: [
          { from: 'a', to: 'b', event: 'go' },
          { from: 'b', to: 'a', event: 'back' },
        ],
        context: {},
        historyLimit: 3,
      });
      m.transition('go');
      m.transition('back');
      m.transition('go');
      m.transition('back');
      expect(m.history()).toHaveLength(3);
    });

    it('history returns a copy (modifying does not affect internal state)', () => {
      machine.transition('start');
      const h = machine.history();
      h.splice(0, 1);
      expect(machine.history()).toHaveLength(1);
    });
  });

  // --- reset ---

  describe('reset', () => {
    it('resets to initial state', () => {
      machine.transition('start');
      machine.reset();
      expect(machine.current()).toBe('idle');
    });

    it('clears history', () => {
      machine.transition('start');
      machine.reset();
      expect(machine.history()).toHaveLength(0);
    });

    it('resets context to initial values', () => {
      machine.updateContext((c) => ({ ...c, attempts: 7 }));
      machine.reset();
      expect(machine.context().attempts).toBe(0);
    });

    it('listeners are still active after reset', () => {
      const calls: number[] = [];
      machine.onTransition(() => calls.push(1));
      machine.reset();
      machine.transition('start');
      expect(calls).toHaveLength(1);
    });
  });

  // --- serialize / restore ---

  describe('serialize / restore', () => {
    it('serialize returns $schema, current, context, history, timestamp', () => {
      machine.transition('start');
      const data = machine.serialize();
      expect(data.$schema).toBe('1.0.0');
      expect(data.current).toBe('working');
      expect(data.context).toEqual({ attempts: 0, allowed: true });
      expect(data.history).toHaveLength(1);
      expect(typeof data.timestamp).toBe('string');
    });

    it('restore creates machine with serialized current state', () => {
      machine.transition('start');
      const data = machine.serialize();
      const restored = StateMachine.restore(makeConfig(), data);
      expect(restored.current()).toBe('working');
    });

    it('restore preserves context', () => {
      machine.updateContext((c) => ({ ...c, attempts: 3 }));
      const data = machine.serialize();
      const restored = StateMachine.restore(makeConfig(), data);
      expect(restored.context().attempts).toBe(3);
    });

    it('restore preserves history', () => {
      machine.transition('start');
      machine.transition('finish');
      const data = machine.serialize();
      const restored = StateMachine.restore(makeConfig(), data);
      expect(restored.history()).toHaveLength(2);
    });

    it('restored machine can continue transitioning', () => {
      machine.transition('start');
      const data = machine.serialize();
      const restored = StateMachine.restore(makeConfig(), data);
      expect(restored.transition('finish')).toBe(true);
      expect(restored.current()).toBe('done');
    });
  });
});
