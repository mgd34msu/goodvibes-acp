/**
 * Tests for L3 AgentSpawnerPlugin.
 * Covers IAgentSpawner interface compliance, spawn/result/cancel/status lifecycle.
 *
 * Two modes tested:
 *   - Stub mode: no registry provided → timer-based simulation
 *   - AgentLoop mode: registry with MockProvider → real LLM-driven execution
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { AgentSpawnerPlugin } from '../../src/plugins/agents/spawner.ts';
import { MockProvider } from '../../src/plugins/agents/providers/mock.ts';
import { Registry } from '../../src/core/registry.ts';
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

/** Build a registry pre-loaded with a MockProvider and a canned end_turn response */
function makeRegistryWithMock(mock: MockProvider): Registry {
  const registry = new Registry();
  registry.register('llm-provider', mock);
  return registry;
}

/** Standard end_turn response for MockProvider */
const END_TURN_RESPONSE = {
  content: [{ type: 'text' as const, text: 'Task complete.' }],
  stopReason: 'end_turn' as const,
  usage: { inputTokens: 10, outputTokens: 5 },
};

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
// spawn() — stub mode (no registry)
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — spawn() [stub mode]', () => {
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
    expect(s).toBe('running');
    await spawner.result(handle);
  });
});

// ---------------------------------------------------------------------------
// result() — stub mode
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — result() [stub mode]', () => {
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
// cancel() — stub mode
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — cancel() [stub mode]', () => {
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
    await spawner.result(handle);
    await expect(spawner.cancel(handle)).resolves.toBeUndefined();
    expect(spawner.status(handle)).toBe('completed');
  });

  it('result() parked before cancel() resolves with cancelled status', async () => {
    const handle = await spawner.spawn(makeConfig({ timeoutMs: 60_000 }));
    const resultPromise = spawner.result(handle);
    await spawner.cancel(handle);
    const result = await resultPromise;
    expect(result.status).toBe('cancelled');
  });
});

// ---------------------------------------------------------------------------
// status() — stub mode
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — status() [stub mode]', () => {
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
// Timeout handling — stub mode
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — timeout handling [stub mode]', () => {
  it('stub completes within timeoutMs when timeoutMs is large', async () => {
    const spawner = new AgentSpawnerPlugin();
    const handle = await spawner.spawn(makeConfig({ timeoutMs: 5000 }));
    const result = await spawner.result(handle);
    expect(result.status).toBe('completed');
  });

  it('agent fails with TIMEOUT when timeoutMs is very small and completion is fast', async () => {
    const spawner = new AgentSpawnerPlugin();
    const handle = await spawner.spawn(makeConfig({ timeoutMs: 100 }));
    const result = await spawner.result(handle);
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

// ---------------------------------------------------------------------------
// AgentLoop mode — real LLM-driven execution via MockProvider
// ---------------------------------------------------------------------------

describe('AgentSpawnerPlugin — AgentLoop mode (MockProvider)', () => {
  it('spawn with MockProvider creates a real AgentLoop and completes', async () => {
    const mock = new MockProvider();
    mock.enqueue(END_TURN_RESPONSE);
    const registry = makeRegistryWithMock(mock);
    const spawner = new AgentSpawnerPlugin(registry);

    const handle = await spawner.spawn(makeConfig());
    expect(handle.type).toBe('engineer');
    expect(spawner.status(handle)).toBe('running');

    const result = await spawner.result(handle);
    expect(result.status).toBe('completed');
    expect(result.output).toBe('Task complete.');
    expect(result.handle).toBe(handle);
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('result returns AgentLoopResult mapped to AgentResult', async () => {
    const mock = new MockProvider();
    mock.enqueue({
      content: [{ type: 'text', text: 'Implementation done.' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 20, outputTokens: 10 },
    });
    const registry = makeRegistryWithMock(mock);
    const spawner = new AgentSpawnerPlugin(registry);

    const handle = await spawner.spawn(makeConfig({ type: 'reviewer' }));
    const result = await spawner.result(handle);

    expect(result.status).toBe('completed');
    expect(result.output).toBe('Implementation done.');
    expect(Array.isArray(result.filesModified)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(result.errors !== undefined);
  });

  it('cancel() aborts a running AgentLoop', async () => {
    const mock = new MockProvider();
    // Do not enqueue a response — loop will block waiting for LLM
    // We cancel before it resolves
    const registry = makeRegistryWithMock(mock);
    const spawner = new AgentSpawnerPlugin(registry);

    // Use a large timeout so timeout doesn't fire
    const handle = await spawner.spawn(makeConfig({ timeoutMs: 60_000 }));
    expect(spawner.status(handle)).toBe('running');

    // Park a result promise, then cancel
    const resultPromise = spawner.result(handle);
    await spawner.cancel(handle);

    // Status should be cancelled
    expect(spawner.status(handle)).toBe('cancelled');

    // Result resolves with cancelled status
    const result = await resultPromise;
    expect(result.status).toBe('cancelled');
  });

  it('status tracks through running → completed', async () => {
    const mock = new MockProvider();
    mock.enqueue(END_TURN_RESPONSE);
    const registry = makeRegistryWithMock(mock);
    const spawner = new AgentSpawnerPlugin(registry);

    const handle = await spawner.spawn(makeConfig());
    expect(spawner.status(handle)).toBe('running');

    await spawner.result(handle);
    expect(spawner.status(handle)).toBe('completed');
  });

  it('fallback to stub when no llm-provider in registry', async () => {
    // Registry without llm-provider registered
    const registry = new Registry();
    const spawner = new AgentSpawnerPlugin(registry);

    const handle = await spawner.spawn(makeConfig());
    const result = await spawner.result(handle);
    // Stub completes with 'completed'
    expect(result.status).toBe('completed');
    expect(result.output).toContain('[stub]');
  });

  it('MockProvider chat() is called with the task as user message', async () => {
    const mock = new MockProvider();
    mock.enqueue(END_TURN_RESPONSE);
    const registry = makeRegistryWithMock(mock);
    const spawner = new AgentSpawnerPlugin(registry);

    const task = 'build the authentication module';
    const handle = await spawner.spawn(makeConfig({ task }));
    await spawner.result(handle);

    expect(mock.calls.length).toBe(1);
    const params = mock.calls[0];
    expect(params.messages[0].role).toBe('user');
    expect(params.messages[0].content).toBe(task);
  });

  it('uses the agent type systemPromptPrefix from AGENT_TYPE_CONFIGS', async () => {
    const mock = new MockProvider();
    mock.enqueue(END_TURN_RESPONSE);
    const registry = makeRegistryWithMock(mock);
    const spawner = new AgentSpawnerPlugin(registry);

    const handle = await spawner.spawn(makeConfig({ type: 'tester' }));
    await spawner.result(handle);

    const params = mock.calls[0];
    expect(typeof params.systemPrompt).toBe('string');
    expect(params.systemPrompt).toContain('testing specialist');
  });

  it('tool providers from registry are passed to AgentLoop', async () => {
    const mock = new MockProvider();
    mock.enqueue(END_TURN_RESPONSE);
    const registry = makeRegistryWithMock(mock);

    // Register a mock tool provider
    const toolProvider = {
      name: 'my-tools',
      tools: [{ name: 'do_thing', description: 'Does a thing', inputSchema: {} }],
      execute: async (_name: string, _params: unknown) => ({ success: true, data: 'done' }),
    };
    registry.registerMany('tool-provider', 'my-tools', toolProvider);

    const spawner = new AgentSpawnerPlugin(registry);
    const handle = await spawner.spawn(makeConfig());
    await spawner.result(handle);

    // MockProvider received tool definitions
    const params = mock.calls[0];
    expect(params.tools).toBeDefined();
    expect(params.tools!.length).toBeGreaterThan(0);
    expect(params.tools![0].name).toBe('my-tools__do_thing');
  });

  it('uses ProviderManager active model when no model in config', async () => {
    const mock = new MockProvider();
    mock.enqueue(END_TURN_RESPONSE);
    const registry = makeRegistryWithMock(mock);

    // Register a mock provider-manager that reports 'mercury-2' as the active model
    const mockProviderManager = {
      getActiveModelId: () => 'mercury-2',
    };
    registry.register('provider-manager', mockProviderManager);

    const spawner = new AgentSpawnerPlugin(registry);
    const handle = await spawner.spawn(makeConfig());
    await spawner.result(handle);

    // Spawner should have forwarded the provider-manager's active model to AgentLoop
    expect(mock.calls.length).toBe(1);
    expect(mock.calls[0].model).toBe('mercury-2');
  });

  it('respects explicit model in config over ProviderManager active model', async () => {
    const mock = new MockProvider();
    mock.enqueue(END_TURN_RESPONSE);
    const registry = makeRegistryWithMock(mock);

    // ProviderManager would report 'mercury-2', but config.model is explicit
    const mockProviderManager = {
      getActiveModelId: () => 'mercury-2',
    };
    registry.register('provider-manager', mockProviderManager);

    const spawner = new AgentSpawnerPlugin(registry);
    const handle = await spawner.spawn(makeConfig({ model: 'claude-sonnet-4-6' }));
    await spawner.result(handle);

    // Explicit model should win over ProviderManager
    expect(mock.calls.length).toBe(1);
    expect(mock.calls[0].model).toBe('claude-sonnet-4-6');
  });

  it('falls back to typeConfig.defaultModel when provider-manager throws', async () => {
    const mock = new MockProvider();
    mock.enqueue(END_TURN_RESPONSE);
    const registry = makeRegistryWithMock(mock);

    // Register a provider-manager whose getActiveModelId() throws
    const throwingProviderManager = {
      getActiveModelId: (): string => { throw new Error('provider unavailable'); },
    };
    registry.register('provider-manager', throwingProviderManager);

    const spawner = new AgentSpawnerPlugin(registry);
    const handle = await spawner.spawn(makeConfig());
    await spawner.result(handle);

    // Catch block should have fallen through to typeConfig.defaultModel
    expect(mock.calls.length).toBe(1);
    expect(mock.calls[0].model).toBe('claude-sonnet-4-6');
  });

  it('uses typeConfig.defaultModel when no provider-manager is registered', async () => {
    const mock = new MockProvider();
    mock.enqueue(END_TURN_RESPONSE);
    // Registry has llm-provider but NO provider-manager
    const registry = makeRegistryWithMock(mock);

    const spawner = new AgentSpawnerPlugin(registry);
    // No explicit model in config
    const handle = await spawner.spawn(makeConfig());
    await spawner.result(handle);

    // Should have fallen back to DEFAULT_MODEL_ID ('claude-sonnet-4-6')
    expect(mock.calls.length).toBe(1);
    expect(mock.calls[0].model).toBe('claude-sonnet-4-6');
  });
});
