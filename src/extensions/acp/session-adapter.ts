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
    ];
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

    // Retrieve the current session context to build accurate config options
    const context = await this.sessions.get(sessionId).catch(() => undefined);
    if (!context) return;

    const update: schema.SessionUpdate = {
      sessionUpdate: 'session_info_update' as const,
      title: `Mode changed to: ${to}`,
      updatedAt: new Date().toISOString(),
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
    } catch {
      // Connection may be closed — swallow silently
    }
  }
}
