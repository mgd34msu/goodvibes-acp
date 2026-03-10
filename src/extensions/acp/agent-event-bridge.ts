/**
 * @module acp/agent-event-bridge
 * @layer L2 — ACP agent lifecycle bridge
 *
 * Bridges agent lifecycle events from the EventBus to ACP session updates.
 * Each agent spawn appears as a tool_call (pending → running → completed/failed).
 */

import type * as acp from '@agentclientprotocol/sdk';
import type { EventBus, Disposable } from '../../core/event-bus.js';
import type { AgentTracker } from '../agents/tracker.js';
import type { AgentRegisteredPayload, AgentStatusChangedPayload } from '../agents/tracker.js';
import { ToolCallEmitter } from './tool-call-emitter.js';

// ---------------------------------------------------------------------------
// AgentEventBridge
// ---------------------------------------------------------------------------

/**
 * Bridges agent lifecycle events from the EventBus to ACP session updates.
 *
 * Each agent spawn appears as a tool_call (pending → running → completed/failed).
 * Uses ToolCallEmitter for consistent ACP wire format.
 */
export class AgentEventBridge {
  private readonly _emitter: ToolCallEmitter;
  private _disposables: Disposable[] = [];

  constructor(
    private readonly conn: acp.AgentSideConnection,
    private readonly eventBus: EventBus,
    private readonly tracker: AgentTracker,
  ) {
    this._emitter = new ToolCallEmitter(conn);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start listening for agent events and forwarding to ACP.
   *
   * agent:registered  → tool_call (pending)
   * agent:status-changed → tool_call_update (running/completed/failed)
   */
  register(): void {
    this._disposables.push(
      this.eventBus.on<AgentRegisteredPayload>('agent:registered', (event) => {
        const { metadata } = event.payload;
        if (!metadata?.sessionId) return;

        const toolCallId = `goodvibes_agent_${metadata.id}`;
        const title = `${metadata.type}: ${(metadata.task ?? '').slice(0, 80)}`;

        this._emitter
          .emitToolCall(
            metadata.sessionId,
            toolCallId,
            'goodvibes_agent',
            title,
            'other',
            {
              '_goodvibes/agentId': metadata.id,
              '_goodvibes/agentType': metadata.type,
            },
          )
          .catch((err) => { console.error('[AgentEventBridge] emitToolCall(agent:registered) failed:', String(err)); });
      }),
    );

    this._disposables.push(
      this.eventBus.on<AgentStatusChangedPayload>('agent:status-changed', (event) => {
        const { agentId, to } = event.payload;
        if (!agentId) return;

        // Resolve sessionId from event.sessionId (set by EventBus from payload.sessionId)
        // or fall back to tracker lookup (agent:status-changed payload has no sessionId).
        const sessionId = event.sessionId ?? this.tracker.get(agentId)?.sessionId;
        if (!sessionId) return;

        const toolCallId = `goodvibes_agent_${agentId}`;
        // ISS-011: map 'cancelled' to ACP 'cancelled' (not 'failed')
        // ISS-012: map 'failed' to ACP 'error' (not 'failed' — SDK v0.15.0 ToolCallStatus
        //          only has 'pending'|'in_progress'|'completed'|'failed', but 'cancelled'
        //          and 'error' are semantically correct per the ACP spec. Using type cast
        //          to preserve correct semantics while acknowledging the SDK/spec delta.)
        const status = (
          to === 'running'    ? 'in_progress'
          : to === 'completed'  ? 'completed'
          : to === 'cancelled'  ? 'cancelled'
          : to === 'failed'     ? 'error'
          : 'in_progress'
        ) as acp.ToolCallStatus;

        this._emitter
          .emitToolCallUpdate(sessionId, toolCallId, status)
          .catch((err) => { console.error('[AgentEventBridge] emitToolCallUpdate(agent:status-changed) failed:', String(err)); });
      }),
    );
  }

  /**
   * Stop listening and clear all subscriptions.
   */
  unregister(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }
}
