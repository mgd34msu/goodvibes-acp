/**
 * session-adapter.ts — ACP session lifecycle adapter
 *
 * L2 Extension — imports from L0 types, L1 core, and L2 sessions.
 * Adapts L2 SessionManager events to ACP session semantics by subscribing
 * to EventBus events and forwarding them as ACP session/update notifications.
 */

import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type * as schema from '@agentclientprotocol/sdk';
import type { SessionState } from '../../types/session.js';
import type { Disposable } from '../../core/event-bus.js';
import { EventBus } from '../../core/event-bus.js';
import { SessionManager } from '../sessions/manager.js';
import { buildConfigOptions, modeFromConfigValue } from './config-adapter.js';

// ---------------------------------------------------------------------------
// SessionAdapter
// ---------------------------------------------------------------------------

/**
 * Bridges L2 SessionManager lifecycle events to ACP session/update calls.
 *
 * Subscribes to the EventBus for session events emitted by SessionManager
 * and translates them into ACP `sessionUpdate` notifications so connected
 * clients observe session state changes in real-time.
 *
 * Usage:
 * ```typescript
 * const adapter = new SessionAdapter(conn, sessionManager, eventBus);
 * adapter.register();
 * // later:
 * adapter.unregister();
 * ```
 */
export class SessionAdapter {
  private _subscriptions: Disposable[] = [];

  constructor(
    private readonly conn: AgentSideConnection,
    private readonly sessions: SessionManager,
    private readonly eventBus: EventBus,
  ) {}

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  /**
   * Subscribe to SessionManager events and bridge to ACP.
   * Idempotent — calling register() multiple times has no effect.
   */
  register(): void {
    if (this._subscriptions.length > 0) return;

    this._subscriptions = [
      // session:created — new session initialized
      this.eventBus.on('session:created', (event) =>
        void this._onSessionCreated(
          event.payload as { sessionId: string; cwd: string; mode: string },
        ),
      ),

      // session:destroyed — session removed
      this.eventBus.on('session:destroyed', (event) =>
        void this._onSessionDestroyed(
          event.payload as { sessionId: string },
        ),
      ),

      // session:state-changed — lifecycle state transition
      this.eventBus.on('session:state-changed', (event) =>
        void this._onSessionStateChanged(
          event.payload as { sessionId: string; from: SessionState; to: SessionState },
        ),
      ),

      // session:mode-changed — operating mode switch
      this.eventBus.on('session:mode-changed', (event) =>
        void this._onSessionModeChanged(
          event.payload as { sessionId: string; from: string; to: string },
        ),
      ),

      // session:config-changed — config option updated
      this.eventBus.on('session:config-changed', (event) =>
        void this._onSessionConfigChanged(
          event.payload as { sessionId: string; key: string; value: string },
        ),
      ),
    ];

    // TODO(ISS-056): Implement session history replay on session/load.
    // When handling a `session/load` request, the adapter MUST:
    //   1. Retrieve stored conversation history via sessions.get(sessionId)
    //   2. Iterate through each HistoryMessage in context.history
    //   3. Emit session/update notifications: user messages as `user_message_chunk`,
    //      agent messages as `agent_message_chunk`, tool interactions as `tool_call`/`tool_call_update`
    //   4. Only send the session/load response (result: null) after all history is replayed
    // Requires hooking into the transport layer to intercept session/load before the response is sent.
  }

  // -------------------------------------------------------------------------
  // unregister
  // -------------------------------------------------------------------------

  /**
   * Unsubscribe all session event listeners.
   */
  unregister(): void {
    for (const sub of this._subscriptions) {
      sub.dispose();
    }
    this._subscriptions = [];
  }

  // -------------------------------------------------------------------------
  // Private event handlers
  // -------------------------------------------------------------------------

  private async _onSessionCreated(payload: {
    sessionId: string;
    cwd: string;
    mode: string;
  }): Promise<void> {
    const { sessionId, mode } = payload;

    const update: schema.SessionUpdate = {
      sessionUpdate: 'session_info_update' as const,
      title: `Session created (mode: ${mode})`,
      updatedAt: new Date().toISOString(),
    };

    await this._safeSessionUpdate(sessionId, update);
  }

  private async _onSessionDestroyed(payload: { sessionId: string }): Promise<void> {
    const { sessionId } = payload;

    const update: schema.SessionUpdate = {
      sessionUpdate: 'session_info_update' as const,
      title: 'Session ended',
      updatedAt: new Date().toISOString(),
    };

    await this._safeSessionUpdate(sessionId, update);
  }

  private async _onSessionStateChanged(payload: {
    sessionId: string;
    from: SessionState;
    to: SessionState;
  }): Promise<void> {
    const { sessionId, from, to } = payload;

    const update: schema.SessionUpdate = {
      sessionUpdate: 'session_info_update' as const,
      title: `Session state: ${from} → ${to}`,
      updatedAt: new Date().toISOString(),
    };

    await this._safeSessionUpdate(sessionId, update);
  }

  private async _onSessionModeChanged(payload: {
    sessionId: string;
    from: string;
    to: string;
  }): Promise<void> {
    const { sessionId, to } = payload;

    const update: schema.SessionUpdate = {
      sessionUpdate: 'current_mode_update' as const,
      currentModeId: to,
    };

    await this._safeSessionUpdate(sessionId, update);
  }

  private async _onSessionConfigChanged(payload: {
    sessionId: string;
    key: string;
    value: string;
  }): Promise<void> {
    const { sessionId } = payload;

    const context = await this.sessions.get(sessionId).catch(() => undefined);
    if (!context) return;

    const { configOptions: storedOptions, mode, model } = context.config;
    const currentMode = modeFromConfigValue(
      storedOptions?.['mode'] ?? mode ?? 'justvibes',
    );
    const currentModel = storedOptions?.['model'] ?? model ?? 'claude-sonnet-4-6';
    const configOptions = buildConfigOptions(currentMode, currentModel);

    const update: schema.SessionUpdate = {
      sessionUpdate: 'config_option_update' as const,
      configOptions,
    };

    await this._safeSessionUpdate(sessionId, update);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Emit a sessionUpdate, swallowing errors.
   *
   * ACP connections may be closed by the time an event fires. Errors are
   * intentionally suppressed to prevent event handler failures from
   * crashing the runtime.
   */
  private async _safeSessionUpdate(
    sessionId: string,
    update: schema.SessionUpdate,
  ): Promise<void> {
    try {
      await this.conn.sessionUpdate({ sessionId, update });
    } catch (err: unknown) {
      // Connection-closed errors are expected for fire-and-forget notifications
      const msg = err instanceof Error ? err.message : String(err);
      const isConnectionClosed = msg.includes('closed') || msg.includes('disposed') || msg.includes('destroyed');
      if (!isConnectionClosed) {
        console.error('[SessionAdapter] sessionUpdate failed:', msg);
      }
    }
  }
}
