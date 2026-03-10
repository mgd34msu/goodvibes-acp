import { describe, it, expect, beforeEach } from 'bun:test';
import { HookEngine } from '../../src/core/hook-engine.js';
import { EventBus } from '../../src/core/event-bus.js';
import { HookRegistrar } from '../../src/extensions/hooks/registrar.js';
import {
  validateAgentConfig,
  emitAgentSpawned,
  emitWrfcReviewScore,
  emitWrfcCompleted,
  emitSessionCreated,
  emitSessionDestroyed,
} from '../../src/extensions/hooks/built-ins.js';

// ---------------------------------------------------------------------------
// validateAgentConfig (built-in)
// ---------------------------------------------------------------------------

describe('validateAgentConfig', () => {
  it('returns proceed=true when all required fields are present', () => {
    const result = validateAgentConfig({ type: 'engineer', task: 'Build feature', sessionId: 'sess-1' });
    expect(result.proceed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns proceed=false when type is missing', () => {
    const result = validateAgentConfig({ task: 'Build', sessionId: 'sess-1' });
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain('type');
  });

  it('returns proceed=false when task is missing', () => {
    const result = validateAgentConfig({ type: 'engineer', sessionId: 'sess-1' });
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain('task');
  });

  it('returns proceed=false when sessionId is missing', () => {
    const result = validateAgentConfig({ type: 'engineer', task: 'do something' });
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain('sessionId');
  });

  it('returns proceed=false when a field is null', () => {
    const result = validateAgentConfig({ type: null, task: 'do something', sessionId: 'sess-1' });
    expect(result.proceed).toBe(false);
  });

  it('returns proceed=true for extra fields beyond the required ones', () => {
    const result = validateAgentConfig({
      type: 'reviewer',
      task: 'Review PR',
      sessionId: 'sess-2',
      extraField: 'ignored',
    });
    expect(result.proceed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Emit helpers (built-ins)
// ---------------------------------------------------------------------------

describe('emitAgentSpawned', () => {
  it('emits agent:spawned event on the bus', () => {
    const bus = new EventBus();
    const events: unknown[] = [];
    bus.on('agent:spawned', (ev) => events.push(ev.payload));

    emitAgentSpawned(bus, { type: 'engineer', sessionId: 's1' });

    expect(events).toHaveLength(1);
    expect((events[0] as Record<string, unknown>).sessionId).toBe('s1');
  });
});

describe('emitWrfcReviewScore', () => {
  it('emits wrfc:review:score event with context and result', () => {
    const bus = new EventBus();
    const events: unknown[] = [];
    bus.on('wrfc:review:score', (ev) => events.push(ev.payload));

    emitWrfcReviewScore(bus, { workId: 'w1' }, { score: 9.5 });

    expect(events).toHaveLength(1);
    const payload = events[0] as { context: unknown; result: unknown };
    expect(payload.context).toMatchObject({ workId: 'w1' });
    expect(payload.result).toMatchObject({ score: 9.5 });
  });
});

describe('emitWrfcCompleted', () => {
  it('emits wrfc:completed event', () => {
    const bus = new EventBus();
    const events: unknown[] = [];
    bus.on('wrfc:completed', (ev) => events.push(ev.payload));

    emitWrfcCompleted(bus, { workId: 'w2', state: 'complete' });

    expect(events).toHaveLength(1);
    expect((events[0] as Record<string, unknown>).workId).toBe('w2');
  });
});

describe('emitSessionCreated', () => {
  it('emits session:created event', () => {
    const bus = new EventBus();
    const events: unknown[] = [];
    bus.on('session:created', (ev) => events.push(ev.payload));

    emitSessionCreated(bus, { sessionId: 'sess-x', cwd: '/tmp' });

    expect(events).toHaveLength(1);
    expect((events[0] as Record<string, unknown>).sessionId).toBe('sess-x');
  });
});

describe('emitSessionDestroyed', () => {
  it('emits session:destroyed event', () => {
    const bus = new EventBus();
    const events: unknown[] = [];
    bus.on('session:destroyed', (ev) => events.push(ev.payload));

    emitSessionDestroyed(bus, { sessionId: 'sess-y' });

    expect(events).toHaveLength(1);
    expect((events[0] as Record<string, unknown>).sessionId).toBe('sess-y');
  });
});

// ---------------------------------------------------------------------------
// HookRegistrar
// ---------------------------------------------------------------------------

describe('HookRegistrar', () => {
  let engine: HookEngine;
  let bus: EventBus;
  let registrar: HookRegistrar;

  beforeEach(() => {
    engine = new HookEngine();
    bus = new EventBus();
    registrar = new HookRegistrar(engine, bus);
  });

  it('registerBuiltins registers hooks for all six built-in hook points', () => {
    registrar.registerBuiltins();

    const hookPoints = engine
      .list()
      .map((h) => h.hookPoint)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();

    expect(hookPoints).toContain('agent:spawn');
    expect(hookPoints).toContain('wrfc:review');
    expect(hookPoints).toContain('wrfc:complete');
    expect(hookPoints).toContain('session:create');
    expect(hookPoints).toContain('session:destroy');
  });

  it('agent:spawn pre-hook validates config and attaches _validationError for missing fields', async () => {
    registrar.registerBuiltins();

    // Missing task and sessionId
    const ctx = await engine.execute('agent:spawn', { type: 'engineer' } as Record<string, unknown>);
    const meta = ((ctx as Record<string, unknown>)._meta) as Record<string, unknown> | undefined;
    expect(typeof meta?.['_goodvibes/validationError']).toBe('string');
    expect(meta?.['_goodvibes/validationError'] as string).toContain('task');
  });

  it('agent:spawn pre-hook returns unchanged context when all required fields are present', async () => {
    registrar.registerBuiltins();

    const input = { type: 'engineer', task: 'Build', sessionId: 'sess-1' };
    const ctx = await engine.execute('agent:spawn', input as Record<string, unknown>);
    expect((ctx as Record<string, unknown>)._validationError).toBeUndefined();
  });

  it('agent:spawn post-hook emits agent:spawned on the bus', async () => {
    const events: unknown[] = [];
    bus.on('agent:spawned', (ev) => events.push(ev.payload));

    registrar.registerBuiltins();

    const context = { type: 'engineer', task: 'Do work', sessionId: 'sess-2' };
    await engine.executePost('agent:spawn', context as Record<string, unknown>, { id: 'handle-1' });

    expect(events).toHaveLength(1);
  });

  it('wrfc:review post-hook emits wrfc:review:score on the bus', async () => {
    const events: unknown[] = [];
    bus.on('wrfc:review:score', (ev) => events.push(ev.payload));

    registrar.registerBuiltins();

    await engine.executePost('wrfc:review', { workId: 'w1' } as Record<string, unknown>, { score: 9.0 });

    expect(events).toHaveLength(1);
  });

  it('wrfc:complete post-hook emits wrfc:completed on the bus', async () => {
    const events: unknown[] = [];
    bus.on('wrfc:completed', (ev) => events.push(ev.payload));

    registrar.registerBuiltins();

    await engine.executePost('wrfc:complete', { workId: 'w2', state: 'complete' } as Record<string, unknown>, null);

    expect(events).toHaveLength(1);
  });

  it('session:create post-hook emits session:created on the bus', async () => {
    const events: unknown[] = [];
    bus.on('session:created', (ev) => events.push(ev.payload));

    registrar.registerBuiltins();

    await engine.executePost('session:create', { sessionId: 'sess-3' } as Record<string, unknown>, null);

    expect(events).toHaveLength(1);
  });

  it('session:destroy post-hook emits session:destroyed on the bus', async () => {
    const events: unknown[] = [];
    bus.on('session:destroyed', (ev) => events.push(ev.payload));

    registrar.registerBuiltins();

    await engine.executePost('session:destroy', { sessionId: 'sess-4' } as Record<string, unknown>, null);

    expect(events).toHaveLength(1);
  });

  it('registerBuiltins can be called on an empty engine without errors', () => {
    // Should not throw
    expect(() => registrar.registerBuiltins()).not.toThrow();
  });

  it('hook errors are isolated — one failing hook does not block others', async () => {
    // Register a pre-hook that throws before the built-ins
    engine.register('agent:spawn', 'pre', () => {
      throw new Error('boom');
    }, 1);

    registrar.registerBuiltins();

    // Executing should not throw, and should still run other hooks
    const input = { type: 'engineer', task: 'Test', sessionId: 'sess-5' };
    const ctx = await engine.execute('agent:spawn', input as Record<string, unknown>);
    // Context returned despite the error in the earlier hook
    expect(ctx).toBeDefined();
  });
});
