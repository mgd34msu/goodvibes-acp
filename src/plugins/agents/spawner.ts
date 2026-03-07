/**
 * @module plugins/agents/spawner
 * @layer L3 — plugin
 *
 * AgentSpawnerPlugin — implements IAgentSpawner from L0 registry.ts.
 *
 * -------------------------------------------------------------------------
 * STUB IMPLEMENTATION
 * -------------------------------------------------------------------------
 * This is a complete interface implementation backed by in-memory simulation.
 * Real agent subprocesses (Claude Code sessions via the Claude Agent SDK) will
 * be substituted here when the SDK integration is built. All callers interact
 * through IAgentSpawner and will be unaffected by that substitution.
 *
 * Stub behaviour:
 *   - spawn()  — creates an in-memory AgentState, immediately transitions to
 *                'running', and schedules resolution after a short delay.
 *   - result() — returns a Promise that resolves when the stub finishes.
 *   - cancel() — kills the pending timer and resolves with 'cancelled'.
 *   - status() — returns the current AgentStatus from internal state.
 * -------------------------------------------------------------------------
 */

import { randomUUID } from 'node:crypto';
import type {
  AgentConfig,
  AgentHandle,
  AgentResult,
  AgentStatus,
  AgentError,
} from '../../types/agent.js';
import type { IAgentSpawner } from '../../types/registry.js';
import { AGENT_TYPE_CONFIGS } from './types.js';

// ---------------------------------------------------------------------------
// Internal state type
// ---------------------------------------------------------------------------

type AgentState = {
  handle: AgentHandle;
  config: AgentConfig;
  status: AgentStatus;
  output: string;
  errors: AgentError[];
  filesModified: string[];
  startedAt?: number;
  finishedAt?: number;
  /** Pending timer handle for stub simulation (replaces ChildProcess in the real impl) */
  timer?: ReturnType<typeof setTimeout>;
  /** Timeout timer handle — cleared when agent reaches a terminal state */
  timeoutTimer?: ReturnType<typeof setTimeout>;
  /** Accumulated resolvers waiting on result() */
  resolvers: Array<(result: AgentResult) => void>;
  /** Accumulated rejecters waiting on result() */
  rejecters: Array<(err: Error) => void>;
};

// ---------------------------------------------------------------------------
// AgentSpawnerPlugin
// ---------------------------------------------------------------------------

export class AgentSpawnerPlugin implements IAgentSpawner {
  private readonly _agents = new Map<string, AgentState>();

  // -------------------------------------------------------------------------
  // spawn
  // -------------------------------------------------------------------------

  async spawn(config: AgentConfig): Promise<AgentHandle> {
    const id = `agent_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const handle: AgentHandle = {
      id,
      type: config.type,
      spawnedAt: Date.now(),
    };

    const typeConfig = AGENT_TYPE_CONFIGS[config.type];
    const timeoutMs = config.timeoutMs ?? typeConfig.defaultTimeoutMs;

    const state: AgentState = {
      handle,
      config,
      status: 'spawned',
      output: '',
      errors: [],
      filesModified: [],
      resolvers: [],
      rejecters: [],
    };

    this._agents.set(id, state);

    // Transition to 'running' synchronously (mirrors real process start)
    state.status = 'running';
    state.startedAt = Date.now();

    // Schedule stub completion — simulates the agent completing its task
    const completionDelayMs = Math.min(timeoutMs, 100);
    state.timer = setTimeout(() => {
      this._complete(id);
    }, completionDelayMs);

    // Schedule timeout cancellation
    state.timeoutTimer = setTimeout(() => {
      const s = this._agents.get(id);
      if (s && s.status === 'running') {
        this._timeout(id);
      }
    }, timeoutMs);

    // Ensure the timeout timer doesn't prevent Node from exiting
    if (typeof state.timeoutTimer.unref === 'function') {
      state.timeoutTimer.unref();
    }

    return handle;
  }

  // -------------------------------------------------------------------------
  // result
  // -------------------------------------------------------------------------

  result(handle: AgentHandle): Promise<AgentResult> {
    const state = this._requireState(handle.id);

    // Already terminal — resolve immediately
    if (
      state.status === 'completed' ||
      state.status === 'failed' ||
      state.status === 'cancelled'
    ) {
      return Promise.resolve(this._buildResult(state));
    }

    // Still running — park a resolver until the state machine fires
    return new Promise<AgentResult>((resolve, reject) => {
      state.resolvers.push(resolve);
      state.rejecters.push(reject);
    });
  }

  // -------------------------------------------------------------------------
  // cancel
  // -------------------------------------------------------------------------

  async cancel(handle: AgentHandle): Promise<void> {
    const state = this._requireState(handle.id);

    if (
      state.status === 'completed' ||
      state.status === 'failed' ||
      state.status === 'cancelled'
    ) {
      // Already terminal — no-op
      return;
    }

    // Clear the pending stub timer
    if (state.timer !== undefined) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    // Clear the timeout timer
    if (state.timeoutTimer !== undefined) {
      clearTimeout(state.timeoutTimer);
      state.timeoutTimer = undefined;
    }

    state.status = 'cancelled';
    state.finishedAt = Date.now();

    this._flushResolvers(state);
  }

  // -------------------------------------------------------------------------
  // status
  // -------------------------------------------------------------------------

  status(handle: AgentHandle): AgentStatus {
    const state = this._requireState(handle.id);
    return state.status;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Resolve an agent as successfully completed */
  private _complete(id: string): void {
    const state = this._agents.get(id);
    if (!state || state.status !== 'running') return;

    state.status = 'completed';
    state.finishedAt = Date.now();
    state.output = `[stub] Agent ${state.config.type} completed task: ${state.config.task}`;
    state.timer = undefined;

    // Clear the timeout timer since the agent completed normally
    if (state.timeoutTimer !== undefined) {
      clearTimeout(state.timeoutTimer);
      state.timeoutTimer = undefined;
    }

    this._flushResolvers(state);
  }

  /** Fail an agent due to timeout */
  private _timeout(id: string): void {
    const state = this._agents.get(id);
    if (!state || state.status !== 'running') return;

    if (state.timer !== undefined) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    state.status = 'failed';
    state.finishedAt = Date.now();
    state.errors.push({
      code: 'TIMEOUT',
      message: `Agent exceeded timeout of ${state.config.timeoutMs ?? AGENT_TYPE_CONFIGS[state.config.type].defaultTimeoutMs}ms`,
    });

    this._flushResolvers(state);
  }

  /** Notify all parked result() promises */
  private _flushResolvers(state: AgentState): void {
    const result = this._buildResult(state);
    for (const resolve of state.resolvers) {
      resolve(result);
    }
    state.resolvers = [];
    state.rejecters = [];
  }

  /** Build an AgentResult from the current state */
  private _buildResult(state: AgentState): AgentResult {
    const spawnedAt = state.handle.spawnedAt;
    const finishedAt = state.finishedAt ?? Date.now();
    return {
      handle: state.handle,
      status: state.status as AgentResult['status'],
      output: state.output,
      filesModified: state.filesModified,
      errors: state.errors,
      durationMs: finishedAt - spawnedAt,
    };
  }

  /** Look up state or throw if unknown */
  private _requireState(id: string): AgentState {
    const state = this._agents.get(id);
    if (!state) {
      throw new Error(`AgentSpawnerPlugin: unknown agent id "${id}"`);
    }
    return state;
  }
}
