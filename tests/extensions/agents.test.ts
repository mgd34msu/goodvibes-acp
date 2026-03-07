import { describe, it, expect, beforeEach } from 'bun:test';
import { StateStore } from '../../src/core/state-store.js';
import { EventBus } from '../../src/core/event-bus.js';
import { Registry } from '../../src/core/registry.js';
import { AgentTracker } from '../../src/extensions/agents/tracker.js';
import { AgentCoordinator } from '../../src/extensions/agents/coordinator.js';
import type { AgentHandle, AgentConfig, AgentMetadata, AgentResult } from '../../src/types/agent.js';
import type { IAgentSpawner } from '../../src/types/registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHandle(id: string): AgentHandle {
  return { id, type: 'engineer', spawnedAt: Date.now() };
}

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    type: 'engineer',
    task: 'Write tests',
    sessionId: 'sess-1',
    ...overrides,
  };
}

function makeResult(handle: AgentHandle): AgentResult {
  return {
    handle,
    status: 'completed',
    output: 'done',
    filesModified: [],
    errors: [],
    durationMs: 10,
  };
}

// ---------------------------------------------------------------------------
// AgentTracker
// ---------------------------------------------------------------------------

describe('AgentTracker', () => {
  let store: StateStore;
  let bus: EventBus;
  let tracker: AgentTracker;

  beforeEach(() => {
    store = new StateStore();
    bus = new EventBus();
    tracker = new AgentTracker(store, bus);
  });

  describe('register', () => {
    it('registers an agent and stores its metadata', () => {
      const handle = makeHandle('agent-1');
      tracker.register(handle, 'sess-1', 'Do some work');

      const meta = tracker.get('agent-1');
      expect(meta).toBeDefined();
      expect(meta!.id).toBe('agent-1');
      expect(meta!.sessionId).toBe('sess-1');
      expect(meta!.task).toBe('Do some work');
      expect(meta!.status).toBe('spawned');
      expect(meta!.type).toBe('engineer');
    });

    it('emits agent:registered event', () => {
      const events: unknown[] = [];
      bus.on('agent:registered', (ev) => events.push(ev.payload));

      const handle = makeHandle('agent-2');
      tracker.register(handle, 'sess-1', 'task');

      expect(events).toHaveLength(1);
      expect((events[0] as { metadata: AgentMetadata }).metadata.id).toBe('agent-2');
    });
  });

  describe('updateStatus', () => {
    it('transitions status and emits agent:status-changed', () => {
      const events: unknown[] = [];
      bus.on('agent:status-changed', (ev) => events.push(ev.payload));

      const handle = makeHandle('agent-3');
      tracker.register(handle, 'sess-1', 'task');
      tracker.updateStatus('agent-3', 'running');

      const meta = tracker.get('agent-3');
      expect(meta!.status).toBe('running');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ agentId: 'agent-3', from: 'spawned', to: 'running' });
    });

    it('records startedAt when transitioning to running', () => {
      const handle = makeHandle('agent-4');
      tracker.register(handle, 'sess-1', 'task');
      tracker.updateStatus('agent-4', 'running');

      const meta = tracker.get('agent-4');
      expect(meta!.startedAt).toBeDefined();
      expect(typeof meta!.startedAt).toBe('number');
    });

    it('records finishedAt and durationMs when transitioning to completed', () => {
      const handle = makeHandle('agent-5');
      tracker.register(handle, 'sess-1', 'task');
      tracker.updateStatus('agent-5', 'running');
      tracker.updateStatus('agent-5', 'completed');

      const meta = tracker.get('agent-5');
      expect(meta!.finishedAt).toBeDefined();
      expect(meta!.durationMs).toBeDefined();
      expect(meta!.durationMs!).toBeGreaterThanOrEqual(0);
    });

    it('emits agent:completed when status becomes completed', () => {
      const events: unknown[] = [];
      bus.on('agent:completed', (ev) => events.push(ev.payload));

      const handle = makeHandle('agent-6');
      tracker.register(handle, 'sess-1', 'task');
      tracker.updateStatus('agent-6', 'completed');

      expect(events).toHaveLength(1);
    });

    it('emits agent:failed when status becomes failed', () => {
      const events: unknown[] = [];
      bus.on('agent:failed', (ev) => events.push(ev.payload));

      const handle = makeHandle('agent-7');
      tracker.register(handle, 'sess-1', 'task');
      tracker.updateStatus('agent-7', 'failed');

      expect(events).toHaveLength(1);
    });

    it('emits agent:failed when status becomes cancelled', () => {
      const events: unknown[] = [];
      bus.on('agent:failed', (ev) => events.push(ev.payload));

      const handle = makeHandle('agent-8');
      tracker.register(handle, 'sess-1', 'task');
      tracker.updateStatus('agent-8', 'cancelled');

      expect(events).toHaveLength(1);
    });

    it('silently ignores updates for unknown agent IDs', () => {
      // Should not throw
      tracker.updateStatus('no-such-agent', 'running');
    });
  });

  describe('getBySession', () => {
    it('returns agents belonging to a specific session', () => {
      tracker.register(makeHandle('a1'), 'sess-A', 'task-1');
      tracker.register(makeHandle('a2'), 'sess-B', 'task-2');
      tracker.register(makeHandle('a3'), 'sess-A', 'task-3');

      const sessA = tracker.getBySession('sess-A');
      expect(sessA).toHaveLength(2);
      expect(sessA.map((m) => m.id).sort()).toEqual(['a1', 'a3']);
    });

    it('returns empty array for session with no agents', () => {
      expect(tracker.getBySession('empty-sess')).toEqual([]);
    });
  });

  describe('active / activeCount', () => {
    it('counts spawned and running agents as active', () => {
      tracker.register(makeHandle('act-1'), 'sess-1', 't');
      tracker.register(makeHandle('act-2'), 'sess-1', 't');
      tracker.updateStatus('act-2', 'running');
      tracker.register(makeHandle('act-3'), 'sess-1', 't');
      tracker.updateStatus('act-3', 'completed');

      expect(tracker.activeCount()).toBe(2);
      const active = tracker.active();
      expect(active.map((m) => m.id).sort()).toEqual(['act-1', 'act-2']);
    });

    it('returns 0 when no active agents', () => {
      expect(tracker.activeCount()).toBe(0);
    });
  });

  describe('remove', () => {
    it('removes a registered agent', () => {
      tracker.register(makeHandle('rm-1'), 'sess-1', 'task');
      tracker.remove('rm-1');

      expect(tracker.get('rm-1')).toBeUndefined();
    });

    it('is safe to call on an already-removed agent', () => {
      // Should not throw
      tracker.remove('ghost-agent');
    });
  });
});

// ---------------------------------------------------------------------------
// AgentCoordinator
// ---------------------------------------------------------------------------

describe('AgentCoordinator', () => {
  let store: StateStore;
  let bus: EventBus;
  let registry: Registry;
  let tracker: AgentTracker;
  let coordinator: AgentCoordinator;

  // Shared spawner state for tests
  let spawnedHandles: AgentHandle[];
  let resolveResult: ((result: AgentResult) => void) | undefined;

  // A mock spawner that immediately spawns agents and resolves results on demand
  function makeMockSpawner(): IAgentSpawner {
    let handleSeq = 0;
    const pendingResults = new Map<string, Promise<AgentResult>>();
    const resolvers = new Map<string, (r: AgentResult) => void>();

    return {
      async spawn(config: AgentConfig): Promise<AgentHandle> {
        const handle: AgentHandle = {
          id: `mock-agent-${++handleSeq}`,
          type: config.type,
          spawnedAt: Date.now(),
        };
        spawnedHandles.push(handle);
        const p = new Promise<AgentResult>((res) => {
          resolvers.set(handle.id, res);
          resolveResult = res;
        });
        pendingResults.set(handle.id, p);
        return handle;
      },
      async result(handle: AgentHandle): Promise<AgentResult> {
        const p = pendingResults.get(handle.id);
        if (!p) return makeResult(handle);
        return p;
      },
      async cancel(_handle: AgentHandle): Promise<void> {},
      status(_handle: AgentHandle) {
        return 'running' as const;
      },
    };
  }

  function resolveSpawnedAgent(handle: AgentHandle, status: AgentResult['status'] = 'completed') {
    bus.emit('agent:completed', { metadata: tracker.get(handle.id) });
    // Also update tracker
    tracker.updateStatus(handle.id, status);
  }

  beforeEach(() => {
    store = new StateStore();
    bus = new EventBus();
    registry = new Registry();
    tracker = new AgentTracker(store, bus);
    spawnedHandles = [];
    resolveResult = undefined;

    const spawner = makeMockSpawner();
    registry.register('agent-spawner', spawner);

    coordinator = new AgentCoordinator(tracker, registry, bus, { maxParallel: 2 });
  });

  describe('spawn within limit', () => {
    it('spawns an agent immediately when under the parallel limit', async () => {
      const handle = await coordinator.spawn(makeConfig());

      expect(handle).toBeDefined();
      expect(handle.id).toMatch(/^mock-agent-/);
    });

    it('registers and marks the agent as running in the tracker', async () => {
      const handle = await coordinator.spawn(makeConfig());

      const meta = tracker.get(handle.id);
      expect(meta).toBeDefined();
      expect(meta!.status).toBe('running');
    });

    it('spawns up to maxParallel agents without queuing', async () => {
      await coordinator.spawn(makeConfig({ task: 'task-1' }));
      await coordinator.spawn(makeConfig({ task: 'task-2' }));

      expect(tracker.activeCount()).toBe(2);
    });
  });

  describe('overflow queuing', () => {
    it('queues a spawn when at the parallel limit', async () => {
      // Fill limit
      const h1 = await coordinator.spawn(makeConfig({ task: 'task-1' }));
      const h2 = await coordinator.spawn(makeConfig({ task: 'task-2' }));
      expect(tracker.activeCount()).toBe(2);

      // Third spawn should be queued (promise not yet resolved)
      let thirdResolved = false;
      const thirdPromise = coordinator.spawn(makeConfig({ task: 'task-3' })).then((h) => {
        thirdResolved = true;
        return h;
      });

      // Yield to microtask queue — third should still be pending
      await new Promise((r) => setTimeout(r, 0));
      expect(thirdResolved).toBe(false);

      // Complete one of the active agents to drain the queue
      resolveSpawnedAgent(h1);
      // Allow drainQueue to fire
      await new Promise((r) => setTimeout(r, 10));

      const h3 = await thirdPromise;
      expect(h3).toBeDefined();
      void h2; // suppress unused warning
    });
  });

  describe('drain queue on completion', () => {
    it('drains queue when an agent completes', async () => {
      const h1 = await coordinator.spawn(makeConfig({ task: 'task-1' }));
      await coordinator.spawn(makeConfig({ task: 'task-2' }));

      let queued = false;
      const queuedPromise = coordinator.spawn(makeConfig({ task: 'task-3' })).then((h) => {
        queued = true;
        return h;
      });

      await new Promise((r) => setTimeout(r, 0));
      expect(queued).toBe(false);

      // Completing h1 should drain the queue
      resolveSpawnedAgent(h1);
      await new Promise((r) => setTimeout(r, 10));

      await queuedPromise;
      expect(queued).toBe(true);
    });
  });
});
