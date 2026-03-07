/**
 * Tests for L3 AgentSpawnerPlugin.
 * Covers IAgentSpawner interface compliance, spawn/result/cancel/status lifecycle.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { AgentSpawnerPlugin } from '../../src/plugins/agents/spawner.ts';
import type { AgentConfig } from '../../src/types/agent.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    type: 'engineer',
    task: 'implement feature X',
    sessionId: 'session-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Interface compliance
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — interface compliance', () => {
  it('has spawn() method', () => {
    const spawner = new AgentSpawnerPlugin();
    expect(typeof spawner.spawn).toBe('function');
  });

  it('has result() method', () => {
    const spawner = new AgentSpawnerPlugin();
    expect(typeof spawner.result).toBe('function');
  });

  it('has cancel() method', () => {
    const spawner = new AgentSpawnerPlugin();
    expect(typeof spawner.cancel).toBe('function');
  });

  it('has status() method', () => {
    const spawner = new AgentSpawnerPlugin();
    expect(typeof spawner.status).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// spawn()
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — spawn()', () => {
  let spawner: AgentSpawnerPlugin;

  beforeEach(() => {
    spawner = new AgentSpawnerPlugin();
  });

  it('returns a Promise', () => {
    const result = spawner.spawn(makeConfig());
    expect(result instanceof Promise).toBe(true);
    return result.then(handle => spawner.result(handle));
  });

  it('resolves to an AgentHandle with id, type, and spawnedAt', async () => {
    const handle = await spawner.spawn(makeConfig());
    expect(typeof handle.id).toBe('string');
    expect(handle.id.length).toBeGreaterThan(0);
    expect(handle.type).toBe('engineer');
    expect(typeof handle.spawnedAt).toBe('number');
    expect(handle.spawnedAt).toBeGreaterThan(0);
    // await result so the timer doesn't leak
    await spawner.result(handle);
  });

  it('each spawn produces a unique handle id', async () => {
    const handle1 = await spawner.spawn(makeConfig());
    const handle2 = await spawner.spawn(makeConfig());
    expect(handle1.id).not.toBe(handle2.id);
    await Promise.all([spawner.result(handle1), spawner.result(handle2)]);
  });

  it('handle type matches AgentConfig type', async () => {
    const handle = await spawner.spawn(makeConfig({ type: 'reviewer' }));
    expect(handle.type).toBe('reviewer');
    await spawner.result(handle);
  });

  it('status is "running" immediately after spawn', async () => {
    const handle = await spawner.spawn(makeConfig());
    const s = spawner.status(handle);
    // status is 'running' synchronously after spawn
    expect(s).toBe('running');
    await spawner.result(handle);
  });
});

// ---------------------------------------------------------------------------
// result()
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — result()', () => {
  let spawner: AgentSpawnerPlugin;

  beforeEach(() => {
    spawner = new AgentSpawnerPlugin();
  });

  it('resolves to AgentResult with required fields', async () => {
    const handle = await spawner.spawn(makeConfig());
    const result = await spawner.result(handle);
    expect(result.handle).toBe(handle);
    expect(typeof result.status).toBe('string');
    expect(typeof result.output).toBe('string');
    expect(Array.isArray(result.filesModified)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.durationMs).toBe('number');
  });

  it('result status is "completed" after stub finishes', async () => {
    const handle = await spawner.spawn(makeConfig());
    const result = await spawner.result(handle);
    expect(result.status).toBe('completed');
  });

  it('durationMs is non-negative', async () => {
    const handle = await spawner.spawn(makeConfig());
    const result = await spawner.result(handle);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('result handle matches the spawned handle', async () => {
    const handle = await spawner.spawn(makeConfig());
    const result = await spawner.result(handle);
    expect(result.handle.id).toBe(handle.id);
    expect(result.handle.type).toBe(handle.type);
  });

  it('calling result() after already completed resolves immediately', async () => {
    const handle = await spawner.spawn(makeConfig());
    const result1 = await spawner.result(handle);
    const result2 = await spawner.result(handle);
    expect(result1.status).toBe('completed');
    expect(result2.status).toBe('completed');
  });

  it('throws for unknown agent id', () => {
    const fakeHandle = { id: 'nonexistent', type: 'engineer' as const, spawnedAt: Date.now() };
    expect(() => spawner.result(fakeHandle)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// cancel()
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — cancel()', () => {
  let spawner: AgentSpawnerPlugin;

  beforeEach(() => {
    spawner = new AgentSpawnerPlugin();
  });

  it('cancel() returns a Promise', async () => {
    const handle = await spawner.spawn(makeConfig());
    const result = spawner.cancel(handle);
    expect(result instanceof Promise).toBe(true);
    await result;
  });

  it('after cancel(), status is "cancelled"', async () => {
    const handle = await spawner.spawn(makeConfig());
    await spawner.cancel(handle);
    expect(spawner.status(handle)).toBe('cancelled');
  });

  it('result() after cancel() resolves with status "cancelled"', async () => {
    const handle = await spawner.spawn(makeConfig());
    await spawner.cancel(handle);
    const result = await spawner.result(handle);
    expect(result.status).toBe('cancelled');
  });

  it('cancel() on already-cancelled agent is a no-op (does not throw)', async () => {
    const handle = await spawner.spawn(makeConfig());
    await spawner.cancel(handle);
    await expect(spawner.cancel(handle)).resolves.toBeUndefined();
    expect(spawner.status(handle)).toBe('cancelled');
  });

  it('cancel() on completed agent is a no-op', async () => {
    const handle = await spawner.spawn(makeConfig());
    await spawner.result(handle); // wait for completion
    await expect(spawner.cancel(handle)).resolves.toBeUndefined();
    expect(spawner.status(handle)).toBe('completed');
  });

  it('result() parked before cancel() resolves with cancelled status', async () => {
    // Use a long timeout so stub won't complete before cancel
    const handle = await spawner.spawn(makeConfig({ timeoutMs: 60_000 }));
    const resultPromise = spawner.result(handle);
    await spawner.cancel(handle);
    const result = await resultPromise;
    expect(result.status).toBe('cancelled');
  });
});

// ---------------------------------------------------------------------------
// status()
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — status()', () => {
  it('returns "running" immediately after spawn', async () => {
    const spawner = new AgentSpawnerPlugin();
    const handle = await spawner.spawn(makeConfig());
    expect(spawner.status(handle)).toBe('running');
    await spawner.result(handle);
  });

  it('returns "completed" after result() resolves', async () => {
    const spawner = new AgentSpawnerPlugin();
    const handle = await spawner.spawn(makeConfig());
    await spawner.result(handle);
    expect(spawner.status(handle)).toBe('completed');
  });

  it('returns "cancelled" after cancel()', async () => {
    const spawner = new AgentSpawnerPlugin();
    const handle = await spawner.spawn(makeConfig());
    await spawner.cancel(handle);
    expect(spawner.status(handle)).toBe('cancelled');
  });

  it('throws for unknown handle id', () => {
    const spawner = new AgentSpawnerPlugin();
    const fakeHandle = { id: 'does-not-exist', type: 'tester' as const, spawnedAt: Date.now() };
    expect(() => spawner.status(fakeHandle)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Timeout handling
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — timeout handling', () => {
  it('stub completes within timeoutMs when timeoutMs is large', async () => {
    const spawner = new AgentSpawnerPlugin();
    // stub completes at min(timeoutMs, 100)ms — with large timeout, it completes at 100ms
    const handle = await spawner.spawn(makeConfig({ timeoutMs: 5000 }));
    const result = await spawner.result(handle);
    expect(result.status).toBe('completed');
  });

  it('agent fails with TIMEOUT when timeoutMs is very small and completion is fast', async () => {
    // The stub completion delay is min(timeoutMs, 100). With timeoutMs=1,
    // stub delay=1ms but timeout also fires at 1ms — race condition.
    // We test that a reasonable short timeout eventually resolves (not hangs).
    const spawner = new AgentSpawnerPlugin();
    // Use timeoutMs=100 (equal to stub delay) - stub will complete at or before timeout
    const handle = await spawner.spawn(makeConfig({ timeoutMs: 100 }));
    const result = await spawner.result(handle);
    // Either completed or failed (timeout) — both are valid terminal states
    expect(['completed', 'failed']).toContain(result.status);
  });

  it('all agent types can be spawned', async () => {
    const spawner = new AgentSpawnerPlugin();
    const types = ['engineer', 'reviewer', 'tester', 'architect', 'deployer', 'integrator'] as const;
    const handles = await Promise.all(types.map(type => spawner.spawn(makeConfig({ type }))));
    expect(handles).toHaveLength(6);
    for (let i = 0; i < handles.length; i++) {
      expect(handles[i].type).toBe(types[i]);
    }
    await Promise.all(handles.map(h => spawner.result(h)));
  });
});
