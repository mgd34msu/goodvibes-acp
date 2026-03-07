/**
 * @module agents/tracker
 * @layer L2 — extensions
 *
 * AgentTracker — registers agent instances, tracks status transitions,
 * stores metadata in the L1 StateStore, and emits lifecycle events via EventBus.
 */

import type { AgentHandle, AgentMetadata, AgentStatus } from '../../types/agent.js';
import { EventBus } from '../../core/event-bus.js';
import { StateStore } from '../../core/state-store.js';

/** Namespace used for all agent metadata in StateStore */
const NS = 'agents';

/** Payloads for agent lifecycle events */
export type AgentRegisteredPayload = { metadata: AgentMetadata };
export type AgentStatusChangedPayload = { agentId: string; from: AgentStatus; to: AgentStatus };
export type AgentCompletedPayload = { metadata: AgentMetadata };
export type AgentFailedPayload = { metadata: AgentMetadata };

/**
 * Tracks agent instance lifecycle: registration, status transitions, and cleanup.
 *
 * All metadata is persisted to a namespaced StateStore. Status transitions
 * emit events on the shared EventBus so other subsystems can react without
 * coupling to this class directly.
 */
export class AgentTracker {
  private readonly _store: StateStore;
  private readonly _bus: EventBus;

  constructor(stateStore: StateStore, eventBus: EventBus) {
    this._store = stateStore;
    this._bus = eventBus;
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Register a newly spawned agent.
   *
   * @param handle  - The handle returned by the spawner.
   * @param sessionId - Session this agent belongs to.
   * @param task    - Task description for this agent.
   */
  register(handle: AgentHandle, sessionId: string, task: string): void {
    const metadata: AgentMetadata = {
      id: handle.id,
      type: handle.type,
      sessionId,
      task,
      status: 'spawned',
      spawnedAt: handle.spawnedAt,
    };

    this._store.set<AgentMetadata>(NS, handle.id, metadata);

    this._bus.emit<AgentRegisteredPayload>('agent:registered', { metadata });
  }

  // ---------------------------------------------------------------------------
  // Status transitions
  // ---------------------------------------------------------------------------

  /**
   * Transition an agent to a new status.
   *
   * Automatically records `startedAt` when transitioning to `'running'` and
   * `finishedAt` / `durationMs` when transitioning to a terminal status.
   *
   * Emits:
   * - `agent:status-changed` always
   * - `agent:completed` when status becomes `'completed'`
   * - `agent:failed`   when status becomes `'failed'` or `'cancelled'`
   */
  updateStatus(agentId: string, status: AgentStatus): void {
    const existing = this._store.get<AgentMetadata>(NS, agentId);
    if (!existing) {
      return;
    }

    const from = existing.status;
    const now = Date.now();

    const updated: AgentMetadata = { ...existing, status };

    if (status === 'running' && updated.startedAt === undefined) {
      updated.startedAt = now;
    }

    const isTerminal = status === 'completed' || status === 'failed' || status === 'cancelled';
    if (isTerminal && updated.finishedAt === undefined) {
      updated.finishedAt = now;
      if (updated.startedAt !== undefined) {
        updated.durationMs = now - updated.startedAt;
      }
    }

    this._store.set<AgentMetadata>(NS, agentId, updated);

    this._bus.emit<AgentStatusChangedPayload>('agent:status-changed', {
      agentId,
      from,
      to: status,
    });

    if (status === 'completed') {
      this._bus.emit<AgentCompletedPayload>('agent:completed', { metadata: updated });
    } else if (status === 'failed' || status === 'cancelled') {
      this._bus.emit<AgentFailedPayload>('agent:failed', { metadata: updated });
    }
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /** Retrieve metadata for a single agent, or undefined if not found. */
  get(agentId: string): AgentMetadata | undefined {
    return this._store.get<AgentMetadata>(NS, agentId);
  }

  /** Retrieve all agents registered under a given session. */
  getBySession(sessionId: string): AgentMetadata[] {
    return this._allMetadata().filter((m) => m.sessionId === sessionId);
  }

  /** Retrieve all agents currently in `'spawned'` or `'running'` status. */
  active(): AgentMetadata[] {
    return this._allMetadata().filter(
      (m) => m.status === 'spawned' || m.status === 'running'
    );
  }

  /** Number of agents currently in `'spawned'` or `'running'` status. */
  activeCount(): number {
    return this.active().length;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Remove a completed agent's metadata from the store.
   * Safe to call on agents that have already been removed.
   */
  remove(agentId: string): void {
    this._store.delete(NS, agentId);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private _allMetadata(): AgentMetadata[] {
    return this._store.keys(NS).map((key) => this._store.get<AgentMetadata>(NS, key)!);
  }
}
