import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.ts';
import { Registry } from '../../src/core/registry.ts';
import { TriggerEngine } from '../../src/core/trigger-engine.ts';
import type { TriggerDefinition, ITriggerHandler, TriggerContext } from '../../src/core/trigger-engine.ts';
import type { EventRecord } from '../../src/core/event-bus.ts';

/** Helper to build a minimal ITriggerHandler stub */
function makeHandler(
  canHandle = true,
  onExecute?: (def: TriggerDefinition, ctx: TriggerContext) => void
): ITriggerHandler {
  return {
    canHandle: (_def) => canHandle,
    execute: async (def, ctx) => {
      onExecute?.(def, ctx);
    },
  };
}

describe('TriggerEngine', () => {
  let bus: EventBus;
  let registry: Registry;
  let engine: TriggerEngine;

  beforeEach(() => {
    bus = new EventBus();
    registry = new Registry();
    engine = new TriggerEngine(bus, registry);
  });

  // --- register ---

  describe('register', () => {
    it('registers a trigger definition', () => {
      engine.register({
        id: 't1',
        name: 'Test Trigger',
        eventPattern: 'test:event',
        handlerKey: 'handler',
      });
      expect(engine.list()).toHaveLength(1);
      expect(engine.get('t1')?.id).toBe('t1');
    });

    it('throws when registering duplicate id', () => {
      const def: TriggerDefinition = {
        id: 'dup',
        name: 'Dup',
        eventPattern: 'x',
        handlerKey: 'h',
      };
      engine.register(def);
      expect(() => engine.register(def)).toThrow("TriggerEngine: trigger 'dup' is already registered");
    });

    it('throws after destroy', () => {
      engine.destroy();
      expect(() =>
        engine.register({ id: 't1', name: 'T', eventPattern: 'x', handlerKey: 'h' })
      ).toThrow('TriggerEngine has been destroyed');
    });
  });

  // --- unregister ---

  describe('unregister', () => {
    it('removes the trigger by id', () => {
      engine.register({ id: 't1', name: 'T', eventPattern: 'x', handlerKey: 'h' });
      engine.unregister('t1');
      expect(engine.list()).toHaveLength(0);
      expect(engine.get('t1')).toBeUndefined();
    });

    it('does not throw when unregistering nonexistent id', () => {
      expect(() => engine.unregister('nonexistent')).not.toThrow();
    });
  });

  // --- enable / disable ---

  describe('enable / disable', () => {
    it('trigger is enabled by default', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'h' });
      bus.emit('test', {});
      // Allow micro-task to flush (execute is async)
      expect(calls).toHaveLength(1);
    });

    it('disabled trigger does not fire', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'h' });
      engine.disable('t1');
      bus.emit('test', {});
      expect(calls).toHaveLength(0);
    });

    it('re-enabling a disabled trigger makes it fire again', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'h' });
      engine.disable('t1');
      bus.emit('test', {});
      engine.enable('t1');
      bus.emit('test', {});
      expect(calls).toHaveLength(1);
    });

    it('enable/disable on nonexistent id does not throw', () => {
      expect(() => engine.enable('none')).not.toThrow();
      expect(() => engine.disable('none')).not.toThrow();
    });

    it('trigger registered with enabled:false starts disabled', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({
        id: 't1',
        name: 'T',
        eventPattern: 'test',
        handlerKey: 'h',
        enabled: false,
      });
      bus.emit('test', {});
      expect(calls).toHaveLength(0);
    });
  });

  // --- event pattern matching ---

  describe('event pattern matching', () => {
    it('exact pattern matches exact event type', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'session:started', handlerKey: 'h' });
      bus.emit('session:started', {});
      bus.emit('session:ended', {});
      expect(calls).toHaveLength(1);
    });

    it('wildcard * matches all events', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: '*', handlerKey: 'h' });
      bus.emit('any:event', {});
      bus.emit('another', {});
      expect(calls).toHaveLength(2);
    });

    it('prefix wildcard session:* matches session-prefixed events', () => {
      const calls: string[] = [];
      registry.register('h', makeHandler(true, (_def, ctx) => calls.push(ctx.event.type)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'session:*', handlerKey: 'h' });
      bus.emit('session:started', {});
      bus.emit('session:ended', {});
      bus.emit('agent:done', {});
      expect(calls).toEqual(['session:started', 'session:ended']);
    });

    it('suffix wildcard *:completed matches events ending with :completed', () => {
      const calls: string[] = [];
      registry.register('h', makeHandler(true, (_def, ctx) => calls.push(ctx.event.type)));
      engine.register({ id: 't1', name: 'T', eventPattern: '*:completed', handlerKey: 'h' });
      bus.emit('agent:completed', {});
      bus.emit('task:completed', {});
      bus.emit('task:started', {});
      expect(calls).toEqual(['agent:completed', 'task:completed']);
    });

    it('regex pattern /session.*/ matches session events', () => {
      const calls: string[] = [];
      registry.register('h', makeHandler(true, (_def, ctx) => calls.push(ctx.event.type)));
      engine.register({ id: 't1', name: 'T', eventPattern: '/session.*/', handlerKey: 'h' });
      bus.emit('session:started', {});
      bus.emit('session_ended', {});
      bus.emit('agent:done', {});
      expect(calls).toEqual(['session:started', 'session_ended']);
    });

    it('non-matching event does not fire', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'specific:event', handlerKey: 'h' });
      bus.emit('different:event', {});
      expect(calls).toHaveLength(0);
    });
  });

  // --- condition function ---

  describe('condition function', () => {
    it('fires when condition returns true', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({
        id: 't1',
        name: 'T',
        eventPattern: 'test',
        handlerKey: 'h',
        condition: (ev: EventRecord) => (ev.payload as { ok: boolean }).ok === true,
      });
      bus.emit('test', { ok: true });
      expect(calls).toHaveLength(1);
    });

    it('does not fire when condition returns false', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({
        id: 't1',
        name: 'T',
        eventPattern: 'test',
        handlerKey: 'h',
        condition: (ev: EventRecord) => (ev.payload as { ok: boolean }).ok === true,
      });
      bus.emit('test', { ok: false });
      expect(calls).toHaveLength(0);
    });
  });

  // --- maxFires ---

  describe('maxFires', () => {
    it('fires exactly maxFires times then stops', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({
        id: 't1',
        name: 'T',
        eventPattern: 'test',
        handlerKey: 'h',
        maxFires: 2,
      });
      bus.emit('test', {});
      bus.emit('test', {});
      bus.emit('test', {});
      expect(calls).toHaveLength(2);
    });

    it('getFireCount tracks correctly', () => {
      registry.register('h', makeHandler(true, () => {}));
      engine.register({
        id: 't1',
        name: 'T',
        eventPattern: 'test',
        handlerKey: 'h',
      });
      expect(engine.getFireCount('t1')).toBe(0);
      bus.emit('test', {});
      expect(engine.getFireCount('t1')).toBe(1);
      bus.emit('test', {});
      expect(engine.getFireCount('t1')).toBe(2);
    });

    it('getFireCount returns 0 for unknown trigger', () => {
      expect(engine.getFireCount('nonexistent')).toBe(0);
    });

    it('unlimited fires when maxFires is undefined', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'h' });
      for (let i = 0; i < 5; i++) bus.emit('test', {});
      expect(calls).toHaveLength(5);
    });
  });

  // --- session scoping ---

  describe('session scoping', () => {
    it('session-scoped trigger only fires for matching sessionId in payload', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({
        id: 't1',
        name: 'T',
        eventPattern: 'test',
        handlerKey: 'h',
        sessionId: 'session-abc',
      });
      bus.emit('test', { sessionId: 'session-abc' });
      bus.emit('test', { sessionId: 'session-xyz' });
      bus.emit('test', {});
      expect(calls).toHaveLength(1);
    });

    it('trigger without sessionId fires for all events', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'h' });
      bus.emit('test', { sessionId: 'any' });
      bus.emit('test', {});
      expect(calls).toHaveLength(2);
    });
  });

  // --- handler lookup ---

  describe('handler lookup', () => {
    it('skips trigger silently when handler not in registry', () => {
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'missing-handler' });
      // Should not throw
      expect(() => bus.emit('test', {})).not.toThrow();
    });

    it('skips trigger when canHandle returns false', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(false, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'h' });
      bus.emit('test', {});
      expect(calls).toHaveLength(0);
    });

    it('passes TriggerContext with correct data to handler', () => {
      const contexts: TriggerContext[] = [];
      registry.register('h', makeHandler(true, (_def, ctx) => contexts.push(ctx)));
      const def: TriggerDefinition = { id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'h' };
      engine.register(def);
      bus.emit('test', { data: 'payload' });
      expect(contexts).toHaveLength(1);
      expect(contexts[0].fireCount).toBe(1);
      expect(contexts[0].trigger).toBe(def);
      expect(contexts[0].event.type).toBe('test');
    });

    it('error in handler is caught and emitted as error event on bus', async () => {
      const errorEvents: unknown[] = [];
      bus.on('error', (ev) => errorEvents.push(ev.payload));

      const failingHandler: ITriggerHandler = {
        canHandle: () => true,
        execute: async () => { throw new Error('handler error'); },
      };
      registry.register('failing-handler', failingHandler);
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'failing-handler' });
      bus.emit('test', {});
      // Allow microtask to flush
      await new Promise((r) => setTimeout(r, 20));
      expect(errorEvents).toHaveLength(1);
      const payload = errorEvents[0] as { source: string; triggerId: string };
      expect(payload.source).toBe('trigger-engine');
      expect(payload.triggerId).toBe('t1');
    });
  });

  // --- evaluate (direct call) ---

  describe('evaluate (direct call)', () => {
    it('can be called directly without going through event bus', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'h' });
      const mockEvent: EventRecord = {
        id: 'ev_1',
        type: 'test',
        payload: {},
        timestamp: Date.now(),
      };
      engine.evaluate(mockEvent);
      expect(calls).toHaveLength(1);
    });

    it('evaluate is a no-op after destroy', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'h' });
      engine.destroy();
      engine.evaluate({ id: 'ev_1', type: 'test', payload: {}, timestamp: Date.now() });
      expect(calls).toHaveLength(0);
    });
  });

  // --- list / get ---

  describe('list / get', () => {
    it('list returns all registered trigger definitions', () => {
      engine.register({ id: 't1', name: 'T1', eventPattern: 'a', handlerKey: 'h' });
      engine.register({ id: 't2', name: 'T2', eventPattern: 'b', handlerKey: 'h' });
      const list = engine.list();
      expect(list).toHaveLength(2);
      expect(list.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    });

    it('get returns undefined for unknown id', () => {
      expect(engine.get('nonexistent')).toBeUndefined();
    });
  });

  // --- destroy ---

  describe('destroy', () => {
    it('clears all triggers', () => {
      engine.register({ id: 't1', name: 'T', eventPattern: 'x', handlerKey: 'h' });
      engine.destroy();
      expect(engine.list()).toHaveLength(0);
    });

    it('unsubscribes from EventBus on destroy — events no longer processed', () => {
      const calls: number[] = [];
      registry.register('h', makeHandler(true, () => calls.push(1)));
      engine.register({ id: 't1', name: 'T', eventPattern: 'test', handlerKey: 'h' });
      engine.destroy();
      bus.emit('test', {});
      expect(calls).toHaveLength(0);
    });
  });
});
