/**
 * @module acp/extensions
 * @layer L2 — ACP protocol layer
 *
 * GoodVibesExtensions — handles _goodvibes/* ACP extension methods.
 * Provides introspection into runtime state, events, agents, and analytics.
 */

import { EventBus } from '../../core/event-bus.js';
import { StateStore } from '../../core/state-store.js';
import { Registry } from '../../core/registry.js';
import { HealthCheck } from '../lifecycle/health.js';
import { AgentTracker } from '../agents/tracker.js';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import { EventRecorder } from './event-recorder.js';

/** Shared version for all _meta fields */
const META_VERSION = '0.1.0';

/** Standard _meta appended to all responses */
const META = { version: META_VERSION, '_goodvibes/version': META_VERSION } as const;

/**
 * Handles all _goodvibes/* method calls.
 *
 * Methods:
 *   _goodvibes/state      — full state snapshot
 *   _goodvibes/events     — recent event stream
 *   _goodvibes/agents     — active agent list
 *   _goodvibes/analytics  — token usage and metrics
 *
 * Note: _goodvibes/status is a push notification (agent → client),
 * not a request handler. Use pushStatus() instead.
 *
 * Agent.extMethod() should delegate to this.handle() for all _goodvibes/* methods
 */
export class GoodVibesExtensions {
  constructor(
    private readonly _eventBus: EventBus,
    private readonly _stateStore: StateStore,
    private readonly _registry: Registry,
    private readonly _healthCheck: HealthCheck,
    private readonly _agentTracker: AgentTracker,
    private readonly _eventRecorder: EventRecorder,
  ) {}

  // ---------------------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------------------

  /**
   * Dispatch a _goodvibes/* method call.
   *
   * Agent.extMethod() should delegate to this.handle() for all _goodvibes/* methods
   *
   * Note: _goodvibes/status is NOT handled here — it is a push notification
   * (agent → client). Use pushStatus() to emit it.
   *
   * @param method - The full method name, e.g. "_goodvibes/state"
   * @param params - Optional parameters (method-specific)
   * @returns Response object (always includes _meta)
   */
  async handle(method: string, params?: unknown): Promise<unknown> {
    switch (method) {
      case '_goodvibes/status':
        return this._status();
      case '_goodvibes/state':
        return this._state();
      case '_goodvibes/events':
        return this._events(params);
      case '_goodvibes/agents':
        return this._agents();
      case '_goodvibes/analytics':
        return this._analytics(params);
      default: {
        // Return a structured error response with _meta rather than throwing,
        // so callers can inspect _meta.version on any response.
        return {
          error: 'unknown_method',
          method,
          code: -32601,
          _meta: META,
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // _goodvibes/status (push notification — agent → client)
  // ---------------------------------------------------------------------------

  private _status(): unknown {
    const health = this._healthCheck.check();

    // Map HealthCheck status to the ACP status vocabulary
    let mappedStatus: 'healthy' | 'degraded' | 'shutting_down';
    switch (health.status) {
      case 'ready':
        mappedStatus = 'healthy';
        break;
      case 'degraded':
        mappedStatus = 'degraded';
        break;
      case 'shutting_down':
        mappedStatus = 'shutting_down';
        break;
      default:
        // 'starting' falls into degraded — runtime is not fully ready
        mappedStatus = 'degraded';
    }

    const activeAgents = this._agentTracker.activeCount();

    // Sessions are stored in stateStore under the 'sessions' namespace.
    // Keys include both `{sessionId}` and `history:{sessionId}` entries —
    // we only count the non-history keys.
    const sessionKeys = this._stateStore
      .keys('sessions')
      .filter((k) => !k.startsWith('history:'));

    // Registered plugins live in the 'plugin' kind of the registry.
    const registeredPlugins = this._registry.kinds().includes('plugin')
      ? this._registry.getAll<{ manifest: { name: string } }>('plugin').map(
          (p: { manifest: { name: string } }) => p.manifest.name,
        )
      : [];

    return {
      health: mappedStatus,
      uptime: health.uptime,
      activeSessionCount: sessionKeys.length,
      activeAgentCount: activeAgents,
      registeredPlugins,
      _meta: META,
    };
  }

  // ---------------------------------------------------------------------------
  // _goodvibes/state
  // ---------------------------------------------------------------------------

  private _state(): unknown {
    // Build sessions summary
    const sessionKeys = this._stateStore
      .keys('sessions')
      .filter((k) => !k.startsWith('history:'));

    const sessions: Record<
      string,
      { id: string; status: string; createdAt: number; promptCount: number }
    > = {};

    for (const key of sessionKeys) {
      const stored = this._stateStore.get<{
        id: string;
        state: string;
        createdAt: number;
      }>('sessions', key);

      if (stored == null) continue;

      // History key stores the array of messages
      const history = this._stateStore.get<unknown[]>(
        'sessions',
        `history:${key}`,
      );

      sessions[key] = {
        id: stored.id,
        status: stored.state,
        createdAt: stored.createdAt,
        promptCount: Array.isArray(history) ? history.length : 0,
      };
    }

    // Build WRFC chains summary from stateStore if present
    const wrfcChains: Record<
      string,
      { phase: string; attempt: number; score?: number }
    > = {};

    if (this._stateStore.namespaces().includes('wrfc')) {
      for (const key of this._stateStore.keys('wrfc')) {
        const ctx = this._stateStore.get<{
          state: string;
          attempt: { attemptNumber: number };
          lastScore?: { overall: number };
        }>('wrfc', key);

        if (ctx == null) continue;

        wrfcChains[key] = {
          phase: ctx.state,
          attempt: ctx.attempt?.attemptNumber ?? 1,
          ...(ctx.lastScore !== undefined ? { score: ctx.lastScore.overall } : {}),
        };
      }
    }

    // Flatten RuntimeConfig to a plain Record for the response
    const config = this._getConfigSnapshot();

    return {
      sessions,
      wrfcChains,
      config,
      _meta: META,
    };
  }

  // ---------------------------------------------------------------------------
  // _goodvibes/events
  // ---------------------------------------------------------------------------

  private _events(params: unknown): unknown {
    // Validate/extract filter params
    let type: string | undefined;
    let sessionId: string | undefined;
    let limit: number | undefined;

    if (params !== null && typeof params === 'object') {
      const p = params as Record<string, unknown>;
      if (typeof p['type'] === 'string') type = p['type'];
      if (typeof p['sessionId'] === 'string') sessionId = p['sessionId'];
      if (typeof p['limit'] === 'number') limit = p['limit'];
    }

    const events = this._eventRecorder.query({ type, sessionId, limit });

    return {
      events,
      _meta: META,
    };
  }

  // ---------------------------------------------------------------------------
  // _goodvibes/agents
  // ---------------------------------------------------------------------------

  private _agents(): unknown {
    const now = Date.now();
    const active = this._agentTracker.active();

    const agents = active.map((m) => ({
      id: m.id,
      type: m.type,
      status: m.status,
      task: m.task,
      sessionId: m.sessionId,
      durationMs: now - m.spawnedAt,
      spawnedAt: m.spawnedAt,
    }));

    return {
      agents,
      _meta: META,
    };
  }

  // ---------------------------------------------------------------------------
  // _goodvibes/analytics
  // ---------------------------------------------------------------------------

  private _analytics(params?: unknown): unknown {
    // Try to get the analytics engine from the registry (L3 plugin).
    // If not registered, return KB-08 compliant zero values.
    const analyticsEngine = this._registry.getOptional<{
      getAnalyticsResponse(
        request?: { sessionId?: string },
      ): {
        tokenUsage: { input: number; output: number; total: number; budget?: number; remaining?: number };
        turnCount: number;
        agentCount: number;
        duration_ms: number;
      };
    }>('analytics-engine');

    const meta = (params as Record<string, unknown> | undefined)?._meta as Record<string, unknown> | undefined;

    if (analyticsEngine === undefined) {
      return {
        tokenUsage: { input: 0, output: 0, total: 0 },
        turnCount: 0,
        agentCount: 0,
        duration_ms: 0,
        _meta: { ...META, ...(meta ?? {}) },
      };
    }

    // Normalise params into a GoodVibesAnalyticsRequest-compatible shape
    const request =
      params !== null && typeof params === 'object'
        ? (params as { sessionId?: string })
        : undefined;

    const response = analyticsEngine.getAnalyticsResponse(request);

    return {
      ...response,
      _meta: { ...META, ...(meta ?? {}) },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Push a _goodvibes/status notification to the client.
   *
   * This is a push notification (agent → client) triggered on WRFC phase changes.
   * The agent layer should call this method rather than routing through handle().
   *
   * @param conn           - The active AgentSideConnection to push through
   * @param sessionId      - The session to notify
   * @param phase          - Current WRFC phase label (e.g. "write", "review")
   * @param completedSteps - Number of steps completed so far
   * @param totalSteps     - Total number of steps expected
   */
  async pushStatus(
    conn: AgentSideConnection,
    sessionId: string,
    phase: string,
    completedSteps: number,
    totalSteps: number,
  ): Promise<void> {
    const health = this._status();
    await conn.extNotification('_goodvibes/status', {
      ...(health as Record<string, unknown>),
      phase,
      completedSteps,
      totalSteps,
      sessionId,
    });
  }

  /**
   * Flatten the runtime config into a plain Record.
   * Tries to retrieve a Config instance from the registry; falls back to {}.
   */
  private _getConfigSnapshot(): Record<string, unknown> {
    const configInstance = this._registry.getOptional<{
      getAll(): Record<string, unknown>;
    }>('config');

    if (configInstance !== undefined) {
      return configInstance.getAll() as Record<string, unknown>;
    }

    return {};
  }
}
