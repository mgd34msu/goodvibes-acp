import { describe, it, expect, mock, beforeEach } from 'bun:test';
import {
  validateAgentConfig,
  emitAgentSpawned,
  emitWrfcReviewScore,
  emitWrfcCompleted,
  emitSessionCreated,
  emitSessionDestroyed,
  type HookContext,
} from '../../src/extensions/hooks/built-ins.ts';
import type { EventBus } from '../../src/core/event-bus.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<HookContext> = {}): HookContext {
  return {
    event: 'agent:spawn',
    timestamp: Date.now(),
    sessionId: 'sess-1',
    type: 'engineer',
    task: 'build something',
    ...overrides,
  };
}

function makeMockBus(): { bus: EventBus; emitted: Array<{ event: string; payload: unknown }> } {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const bus = {
    emit: mock((event: string, payload: unknown) => {
      emitted.push({ event, payload });
    }),
  } as unknown as EventBus;
  return { bus, emitted };
}

// ---------------------------------------------------------------------------
// validateAgentConfig
// ---------------------------------------------------------------------------

describe('validateAgentConfig', () => {
  it('returns proceed: true when all required fields are present', () => {
    const ctx = makeContext({ type: 'engineer', task: 'do it', sessionId: 'sess-1' });
    const result = validateAgentConfig(ctx);
    expect(result.proceed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns proceed: false with reason when type is missing', () => {
    const ctx = makeContext({ type: undefined });
    const result = validateAgentConfig(ctx);
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain('type');
  });

  it('returns proceed: false with reason when task is missing', () => {
    const ctx = makeContext({ task: undefined });
    const result = validateAgentConfig(ctx);
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain('task');
  });

  it('returns proceed: false with reason when sessionId is missing', () => {
    const ctx = makeContext({ sessionId: undefined });
    const result = validateAgentConfig(ctx);
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain('sessionId');
  });

  it('returns proceed: false when type is null', () => {
    const ctx = makeContext({ type: null as unknown as string });
    const result = validateAgentConfig(ctx);
    expect(result.proceed).toBe(false);
  });

  it('returns proceed: false when task is null', () => {
    const ctx = makeContext({ task: null as unknown as string });
    const result = validateAgentConfig(ctx);
    expect(result.proceed).toBe(false);
  });

  it('returns proceed: false when sessionId is null', () => {
    const ctx = makeContext({ sessionId: null as unknown as string });
    const result = validateAgentConfig(ctx);
    expect(result.proceed).toBe(false);
  });

  it('proceeds when mode is set (no warning condition)', () => {
    const ctx = makeContext({ mode: 'auto', permissionPolicy: undefined });
    const result = validateAgentConfig(ctx);
    expect(result.proceed).toBe(true);
  });

  it('proceeds when permissionPolicy is set (no warning condition)', () => {
    const ctx = makeContext({ mode: undefined, permissionPolicy: { allow: 'all' } });
    const result = validateAgentConfig(ctx);
    expect(result.proceed).toBe(true);
  });

  it('proceeds (with console.warn) when neither mode nor permissionPolicy is set', () => {
    const ctx = makeContext({ mode: undefined, permissionPolicy: undefined });
    // Should not throw even when both are absent — just warns
    const result = validateAgentConfig(ctx);
    expect(result.proceed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// emitAgentSpawned
// ---------------------------------------------------------------------------

describe('emitAgentSpawned', () => {
  it('emits agent:spawned event with the context as payload', () => {
    const { bus, emitted } = makeMockBus();
    const ctx = makeContext();
    emitAgentSpawned(bus, ctx);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe('agent:spawned');
    expect(emitted[0].payload).toBe(ctx);
  });

  it('calls bus.emit exactly once', () => {
    const { bus } = makeMockBus();
    emitAgentSpawned(bus, makeContext());
    expect((bus.emit as ReturnType<typeof mock>).mock.calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// emitWrfcReviewScore
// ---------------------------------------------------------------------------

describe('emitWrfcReviewScore', () => {
  it('emits wrfc:review:score with context and result', () => {
    const { bus, emitted } = makeMockBus();
    const ctx = makeContext({ event: 'wrfc:review' });
    const result = { score: 9.5, passed: true };
    emitWrfcReviewScore(bus, ctx, result);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe('wrfc:review:score');
    expect(emitted[0].payload).toEqual({ context: ctx, result });
  });

  it('forwards the result value unchanged', () => {
    const { bus, emitted } = makeMockBus();
    const ctx = makeContext();
    const resultVal = { score: 7.0, passed: false, notes: ['needs work'] };
    emitWrfcReviewScore(bus, ctx, resultVal);
    expect((emitted[0].payload as { result: unknown }).result).toEqual(resultVal);
  });
});

// ---------------------------------------------------------------------------
// emitWrfcCompleted
// ---------------------------------------------------------------------------

describe('emitWrfcCompleted', () => {
  it('emits wrfc:completed with the context as payload', () => {
    const { bus, emitted } = makeMockBus();
    const ctx = makeContext({ event: 'wrfc:complete' });
    emitWrfcCompleted(bus, ctx);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe('wrfc:completed');
    expect(emitted[0].payload).toBe(ctx);
  });
});

// ---------------------------------------------------------------------------
// emitSessionCreated
// ---------------------------------------------------------------------------

describe('emitSessionCreated', () => {
  it('emits session:created with the context as payload', () => {
    const { bus, emitted } = makeMockBus();
    const ctx = makeContext({ event: 'session:create', sessionId: 'new-sess' });
    emitSessionCreated(bus, ctx);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe('session:created');
    expect(emitted[0].payload).toBe(ctx);
  });
});

// ---------------------------------------------------------------------------
// emitSessionDestroyed
// ---------------------------------------------------------------------------

describe('emitSessionDestroyed', () => {
  it('emits session:destroyed with the context as payload', () => {
    const { bus, emitted } = makeMockBus();
    const ctx = makeContext({ event: 'session:destroy', sessionId: 'old-sess' });
    emitSessionDestroyed(bus, ctx);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe('session:destroyed');
    expect(emitted[0].payload).toBe(ctx);
  });
});
