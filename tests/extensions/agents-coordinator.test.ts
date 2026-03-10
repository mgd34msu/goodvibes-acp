import { describe, it, expect, beforeEach } from 'bun:test';
import { StateStore } from '../../src/core/state-store.ts';
import { EventBus } from '../../src/core/event-bus.ts';
import { Registry } from '../../src/core/registry.ts';
import { AgentTracker } from '../../src/extensions/agents/tracker.ts';
import { AgentCoordinator } from '../../src/extensions/agents/coordinator.ts';
import type { AgentConfig, AgentHandle, AgentResult } from '../../src/types/agent.ts';
import type { IAgentSpawner } from '../../src/types/registry.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    type: 'engineer',
    task: 'Test task',
    sessionId: 'sess-1',
    ...overrides,
  };
}

interface MockSpawnerContext {
  spawner: IAgentSpawner;
  resolveById: (id: string, status?: AgentResult['status']) => void;
  rejectById: (id: string, err: Error) => void;
  spawnedHandles: AgentHandle[];
}

function makeMockSpawner(): MockSpawnerContext {
  let seq = 0;
  const handles: AgentHandle[] = [];
  const resolvers = new Map<string, (r: AgentResult) => void>();
  const rejectors = new Map<string, (e: unknown) => void>();
  const promises = new Map<string, Promise<AgentResult>>();

  const spawner: IAgentSpawner = {
    async spawn(config: AgentConfig): Promise<AgentHandle> {
      const handle: AgentHandle = {
        id: `mock-${++seq}`,
        type: config.type,
        spawnedAt: Date.now(),
      };
      handles.push(handle);
      const p = new Promise<AgentResult>((res, rej) => {
        resolvers.set(handle.id, res);
        rejectors.set(handle.id, rej);
      });
      promises.set(handle.id, p);
      return handle;
    },
    async result(handle: AgentHandle): Promise<AgentResult> {
      return promises.get(handle.id) ?? Promise.resolve({
        handle,
        status: 'completed',
        output: 'done',
        filesModified: [],
        errors: [],
        durationMs: 0,
      });
    },
    async cancel(_handle: AgentHandle): Promise<void> {},
    status(_handle: AgentHandle) { return 'running' as const; },
  };

  return {
    spawner,
    spawnedHandles: handles,
    resolveById(id, status = 'completed') {
      resolvers.get(id)?.({ handle: handles.find(h => h.id === id)!, status, output: 'ok', filesModified: [], errors: [], durationMs: 0 });
    },
    rejectById(id, err) {
      rejectors.get(id)?.(err);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentCoordinator (dedicated)', () => {
  let store: StateStore;
  let bus: EventBus;
  let registry: Registry;
  let tracker: AgentTracker;
  let ctx: MockSpawnerContext;
  let coordinator: AgentCoordinator;

  beforeEach(() => {
    store = new StateStore();
    bus = new EventBus();
    registry = new Registry();
    tracker = new AgentTracker(store, bus);
    ctx = makeMockSpawner();
    registry.register('agent-spawner', ctx.spawner);
    coordinator = new AgentCoordinator(tracker, registry, bus, { maxParallel: 2 });
  });

  describe('spawn (under limit)', () => {
    it('immediately spawns and returns a handle when under the limit', async () => {
      const handle = await coordinator.spawn(makeConfig());
      expect(handle.id).toMatch(/^mock-/);
    });

    it('registers the agent with running status in tracker', async () => {
      const handle = await coordinator.spawn(makeConfig());
      expect(tracker.get(handle.id)?.status).toBe('running');
    });

    it('increments activeCount per spawn', async () => {
      await coordinator.spawn(makeConfig({ task: 'a' }));
      await coordinator.spawn(makeConfig({ task: 'b' }));
      expect(tracker.activeCount()).toBe(2);
    });
  });

  describe('spawn (queue overflow)', () => {
    it('queues the third spawn when maxParallel=2 is reached', async () => {
      const h1 = await coordinator.spawn(makeConfig({ task: 'a' }));
      await coordinator.spawn(makeConfig({ task: 'b' }));

      let resolved = false;
      const queued = coordinator.spawn(makeConfig({ task: 'c' })).then((h) => {
        resolved = true;
        return h;
      });

      await new Promise((r) => setTimeout(r, 0));
      expect(resolved).toBe(false);

      // Drain by completing h1
      tracker.updateStatus(h1.id, 'completed');
      bus.emit('agent:completed', { metadata: tracker.get(h1.id) });

      await new Promise((r) => setTimeout(r, 20));
      const h3 = await queued;
      expect(h3).toBeDefined();
    });

    it('drains queue on agent:failed event too', async () => {
      const h1 = await coordinator.spawn(makeConfig({ task: 'a' }));
      await coordinator.spawn(makeConfig({ task: 'b' }));

      let resolved = false;
      const queued = coordinator.spawn(makeConfig({ task: 'c' })).then((h) => {
        resolved = true;
        return h;
      });

      await new Promise((r) => setTimeout(r, 0));
      expect(resolved).toBe(false);

      tracker.updateStatus(h1.id, 'failed');
      bus.emit('agent:failed', { metadata: tracker.get(h1.id) });

      await new Promise((r) => setTimeout(r, 20));
      await queued;
      expect(resolved).toBe(true);
    });
  });

  describe('cancel', () => {
    it('calls spawner.cancel and updates tracker to cancelled', async () => {
      const handle = await coordinator.spawn(makeConfig());
      await coordinator.cancel(handle);
      expect(tracker.get(handle.id)?.status).toBe('cancelled');
    });
  });

  describe('result', () => {
    it('delegates to spawner.result and returns the agent result', async () => {
      const handle = await coordinator.spawn(makeConfig());

      // Resolve asynchronously
      const resultPromise = coordinator.result(handle);
      setTimeout(() => ctx.resolveById(handle.id, 'completed'), 0);

      const result = await resultPromise;
      expect(result.status).toBe('completed');
    });
  });

  describe('status', () => {
    it('delegates to spawner.status', async () => {
      const handle = await coordinator.spawn(makeConfig());
      const s = coordinator.status(handle);
      expect(s).toBe('running');
    });
  });

  describe('toAcpAgentsResponse', () => {
    it('returns empty agents array when session has no agents', () => {
      const resp = coordinator.toAcpAgentsResponse('unknown-sess');
      expect(resp.agents).toEqual([]);
    });

    it('includes all agents for the given session', () => {
      // Register agents directly via tracker to avoid queuing issues with maxParallel
      // (toAcpAgentsResponse maps from tracker, not from spawner state)
      tracker.register({ id: 'a1', type: 'engineer', spawnedAt: 100 }, 'sess-A', 'task-a');
      tracker.register({ id: 'a2', type: 'engineer', spawnedAt: 200 }, 'sess-A', 'task-b');
      tracker.register({ id: 'b1', type: 'tester', spawnedAt: 300 }, 'sess-B', 'task-other');

      const resp = coordinator.toAcpAgentsResponse('sess-A');
      expect(resp.agents).toHaveLength(2);
      expect(resp.agents.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
    });

    it('uses startedAt when available', async () => {
      const handle = await coordinator.spawn(makeConfig());
      // Coordinator immediately sets status to running, which sets startedAt
      const meta = tracker.get(handle.id)!;
      expect(meta.startedAt).toBeDefined();

      const resp = coordinator.toAcpAgentsResponse('sess-1');
      expect(resp.agents[0].startedAt).toBe(meta.startedAt);
    });

    it('falls back to spawnedAt when startedAt is absent', () => {
      // Register directly with tracker (not via coordinator) to skip running transition
      const handle: AgentHandle = { id: 'manual-1', type: 'tester', spawnedAt: 1000 };
      tracker.register(handle, 'sess-test', 'task');
      // metadata now has status=spawned, no startedAt

      const coordWithSameTracker = new AgentCoordinator(tracker, registry, bus);
      const resp = coordWithSameTracker.toAcpAgentsResponse('sess-test');
      expect(resp.agents[0].startedAt).toBe(1000); // spawnedAt
    });

    it('includes score when present in metadata', async () => {
      const handle = await coordinator.spawn(makeConfig({ sessionId: 'sess-score' }));
      // Patch metadata to add score via StateStore directly
      const meta = tracker.get(handle.id)!;
      (tracker as unknown as { _store: { set: (ns: string, k: string, v: unknown) => void } })
        ._store.set('agents', handle.id, { ...meta, score: 9.8 });

      const resp = coordinator.toAcpAgentsResponse('sess-score');
      expect(resp.agents[0].score).toBe(9.8);
    });

    it('omits finishedAt and durationMs for running agents', async () => {
      await coordinator.spawn(makeConfig());
      const resp = coordinator.toAcpAgentsResponse('sess-1');
      expect(resp.agents[0].finishedAt).toBeUndefined();
      expect(resp.agents[0].durationMs).toBeUndefined();
    });

    it('includes finishedAt for completed agents', async () => {
      const handle = await coordinator.spawn(makeConfig());
      tracker.updateStatus(handle.id, 'completed');
      const resp = coordinator.toAcpAgentsResponse('sess-1');
      expect(resp.agents[0].finishedAt).toBeDefined();
    });
  });

  describe('spawn error propagation', () => {
    it('emits agent:spawn-error when spawner.result rejects', async () => {
      const errors: unknown[] = [];
      bus.on('agent:spawn-error', (ev) => errors.push(ev.payload));

      const handle = await coordinator.spawn(makeConfig());
      ctx.rejectById(handle.id, new Error('LLM crashed'));

      await new Promise((r) => setTimeout(r, 10));
      expect(errors).toHaveLength(1);
      expect((errors[0] as { error: string }).error).toBe('LLM crashed');
    });

    it('updates tracker to failed when spawner.result rejects', async () => {
      const handle = await coordinator.spawn(makeConfig());
      ctx.rejectById(handle.id, new Error('timeout'));

      await new Promise((r) => setTimeout(r, 10));
      expect(tracker.get(handle.id)?.status).toBe('failed');
    });
  });

  describe('default maxParallel', () => {
    it('uses 6 as default when no options provided', async () => {
      const defaultCoord = new AgentCoordinator(tracker, registry, bus);
      // Spawn 6 without queuing
      const handles = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          defaultCoord.spawn(makeConfig({ task: `task-${i}`, sessionId: 'sess-default' }))
        )
      );
      expect(handles).toHaveLength(6);
    });
  });
});
