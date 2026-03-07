/**
 * @module agents/coordinator
 * @layer L2 — extensions
 *
 * AgentCoordinator — enforces parallel agent limits, queues overflow,
 * and provides a unified interface for spawning, awaiting, and cancelling agents.
 *
 * The actual agent spawner (L3) is resolved at call-time from the Registry
 * under the well-known key `'agent-spawner'`, keeping L2 free of L3 imports.
 */

import type { AgentConfig, AgentHandle, AgentResult, AgentStatus } from '../../types/agent.js';
import type { IAgentSpawner } from '../../types/registry.js';
import { EventBus } from '../../core/event-bus.js';
import { Registry } from '../../core/registry.js';
import { Queue } from '../../core/queue.js';
import { AgentTracker } from './tracker.js';

/** Default maximum number of concurrently active agents. */
const DEFAULT_MAX_PARALLEL = 6;

/** Registry key used to look up the L3 IAgentSpawner implementation. */
const AGENT_SPAWNER_KEY = 'agent-spawner';

/** Options accepted by the AgentCoordinator constructor. */
export interface AgentCoordinatorOptions {
  /** Maximum number of concurrently running agents (default: 6). */
  maxParallel?: number;
}

/**
 * Coordinates agent spawning with an enforced concurrency limit.
 *
 * When `tracker.activeCount() >= maxParallel` a spawn request is queued.
 * Each time an active agent reaches a terminal state, the coordinator
 * dequeues and spawns the next waiting config automatically.
 */
export class AgentCoordinator {
  private readonly _tracker: AgentTracker;
  private readonly _registry: Registry;
  private readonly _bus: EventBus;
  private readonly _queue: Queue<AgentConfig>;
  private readonly _maxParallel: number;

  constructor(
    tracker: AgentTracker,
    registry: Registry,
    eventBus: EventBus,
    options?: AgentCoordinatorOptions,
  ) {
    this._tracker = tracker;
    this._registry = registry;
    this._bus = eventBus;
    this._queue = new Queue<AgentConfig>();
    this._maxParallel = options?.maxParallel ?? DEFAULT_MAX_PARALLEL;

    // Listen for terminal events to drain the queue.
    this._bus.on('agent:completed', () => this._drainQueue());
    this._bus.on('agent:failed', () => this._drainQueue());
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Spawn an agent if under the parallel limit; otherwise enqueue it.
   *
   * When the agent is spawned immediately, the returned handle is registered
   * with the tracker so callers can observe its lifecycle. When queued, the
   * returned promise resolves with the handle once the agent actually starts.
   */
  async spawn(config: AgentConfig): Promise<AgentHandle> {
    if (this._tracker.activeCount() < this._maxParallel) {
      return this._spawnNow(config);
    }

    // Over the limit — enqueue and return a promise that resolves when the
    // agent is eventually spawned.
    return new Promise<AgentHandle>((resolve, reject) => {
      // Wrap the config with resolution callbacks stored in the event bus
      // closure. We accomplish this by extending the config with a synthetic
      // per-item key and keeping a local map.
      this._pendingResolvers.set(config, { resolve, reject });
      this._queue.enqueue(config);
    });
  }

  /**
   * Await the result of a previously spawned agent.
   * Resolves on completion, failure, or cancellation.
   */
  async result(handle: AgentHandle): Promise<AgentResult> {
    const spawner = this._getSpawner();
    return spawner.result(handle);
  }

  /**
   * Cancel a running agent.
   * The tracker status will be updated to `'cancelled'` via the spawner.
   */
  async cancel(handle: AgentHandle): Promise<void> {
    const spawner = this._getSpawner();
    await spawner.cancel(handle);
    this._tracker.updateStatus(handle.id, 'cancelled');
  }

  /**
   * Return the current status of an agent.
   * Falls back to the tracker when the spawner does not have the agent.
   */
  status(handle: AgentHandle): AgentStatus {
    const spawner = this._getSpawner();
    return spawner.status(handle);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Map from queued AgentConfig objects to their pending resolve/reject.
   * Uses reference equality (Map key = object reference).
   */
  private readonly _pendingResolvers = new Map<
    AgentConfig,
    { resolve: (h: AgentHandle) => void; reject: (err: unknown) => void }
  >();

  /** Resolve the L3 spawner from the registry at call-time. */
  private _getSpawner(): IAgentSpawner {
    return this._registry.get<IAgentSpawner>(AGENT_SPAWNER_KEY);
  }

  /** Spawn an agent immediately, register it with the tracker. */
  private async _spawnNow(config: AgentConfig): Promise<AgentHandle> {
    const spawner = this._getSpawner();
    const handle = await spawner.spawn(config);
    this._tracker.register(handle, config.sessionId, config.task);

    // Update tracker to 'running' once the spawner has the agent going.
    // The spawner itself may emit further updates; this is the initial transition.
    this._tracker.updateStatus(handle.id, 'running');

    // When the agent finishes, update the tracker with the terminal status.
    spawner.result(handle).then(
      (res) => {
        this._tracker.updateStatus(handle.id, res.status);
      },
      (err: unknown) => {
        this._tracker.updateStatus(handle.id, 'failed');
        this._bus.emit('agent:spawn-error', {
          agentId: handle.id,
          error: err instanceof Error ? err.message : String(err),
        });
      },
    );

    return handle;
  }

  /**
   * Attempt to dequeue and spawn the next waiting config.
   * Called whenever an active agent reaches a terminal state.
   */
  private _drainQueue(): void {
    if (this._queue.isEmpty()) return;
    if (this._tracker.activeCount() >= this._maxParallel) return;

    const nextConfig = this._queue.dequeue();
    if (!nextConfig) return;

    const resolvers = this._pendingResolvers.get(nextConfig);
    this._pendingResolvers.delete(nextConfig);

    this._spawnNow(nextConfig).then(
      (handle) => resolvers?.resolve(handle),
      (err) => resolvers?.reject(err),
    );
  }
}
