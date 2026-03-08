/**
 * @module wrfc/wrfc-event-bridge
 * @layer L2 — WRFC ACP bridge
 *
 * Bridges WRFC lifecycle events from the EventBus to ACP tool_call /
 * tool_call_update session notifications so ACP clients can observe
 * Work, Review, and Fix phase progress.
 *
 * Each WRFC phase emits:
 *   1. tool_call (pending)       — phase announced
 *   2. tool_call_update (in_progress) — phase executing
 *   3. tool_call_update (completed | failed) — phase finished
 */

import type { Disposable, EventBus } from '../../core/event-bus.js';
import { ToolCallEmitter } from '../acp/tool-call-emitter.js';
import { WRFC_TOOL_NAMES } from '../../types/constants.js';
import type * as acp from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// Payload shapes emitted by WRFCOrchestrator
// ---------------------------------------------------------------------------

interface WorkCompletePayload {
  workId: string;
  sessionId: string;
  filesModified: string[];
}

interface ReviewCompletePayload {
  workId: string;
  sessionId: string;
  score: number;
  passed: boolean;
}

interface FixCompletePayload {
  workId: string;
  sessionId: string;
  resolvedIssues: string[];
}

interface StateChangedPayload {
  workId: string;
  sessionId: string;
  from: string;
  to: string;
  attempt: number;
}

interface ChainCompletePayload {
  workId: string;
  sessionId: string;
  finalState: string;
  score?: number;
}

// ---------------------------------------------------------------------------
// WRFCEventBridge
// ---------------------------------------------------------------------------

/**
 * Subscribes to WRFC lifecycle events on the EventBus and translates them
 * to ACP tool_call / tool_call_update notifications.
 *
 * Usage:
 * ```typescript
 * const bridge = new WRFCEventBridge(conn, eventBus);
 * bridge.register();
 * // later:
 * bridge.unregister();
 * ```
 */
export class WRFCEventBridge {
  private readonly _emitter: ToolCallEmitter;
  private _disposables: Disposable[] = [];

  /** Active tool call IDs keyed by `${workId}:${phase}` */
  private readonly _activeToolCalls = new Map<string, string>();

  constructor(
    conn: acp.AgentSideConnection,
    private readonly eventBus: EventBus,
  ) {
    this._emitter = new ToolCallEmitter(conn);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start listening for WRFC events and forwarding to ACP.
   * Idempotent — calling register() multiple times has no effect.
   */
  register(): void {
    if (this._disposables.length > 0) return;

    // work phase: state-changed to 'working' → tool_call pending + in_progress
    this._disposables.push(
      this.eventBus.on<StateChangedPayload>('wrfc:state-changed', (event) => {
        const p = event.payload;
        if (!p || typeof p !== 'object') return;
        const payload = p as StateChangedPayload;

        if (payload.to === 'working') {
          const toolCallId = this._toolCallId(payload.workId, 'work');
          this._emitter
            .emitToolCall(
              payload.sessionId,
              toolCallId,
              WRFC_TOOL_NAMES.WORK,
              'Work phase starting…',
              'other',
              {
                '_goodvibes/phase': 'work',
                '_goodvibes/attempt': payload.attempt,
              },
            )
            .catch(() => {});

          // Immediately transition to in_progress
          this._emitter
            .emitToolCallUpdate(payload.sessionId, toolCallId, 'in_progress', {
              '_goodvibes/phase': 'work',
              '_goodvibes/attempt': payload.attempt,
            })
            .catch(() => {});
        } else if (payload.to === 'reviewing') {
          const toolCallId = this._toolCallId(payload.workId, 'review');
          this._emitter
            .emitToolCall(
              payload.sessionId,
              toolCallId,
              WRFC_TOOL_NAMES.REVIEW,
              'Review phase starting…',
              'other',
              {
                '_goodvibes/phase': 'review',
                '_goodvibes/attempt': payload.attempt,
              },
            )
            .catch(() => {});

          this._emitter
            .emitToolCallUpdate(payload.sessionId, toolCallId, 'in_progress', {
              '_goodvibes/phase': 'review',
              '_goodvibes/attempt': payload.attempt,
            })
            .catch(() => {});
        } else if (payload.to === 'fixing') {
          const toolCallId = this._toolCallId(payload.workId, 'fix');
          this._emitter
            .emitToolCall(
              payload.sessionId,
              toolCallId,
              WRFC_TOOL_NAMES.FIX,
              'Fix phase starting…',
              'other',
              {
                '_goodvibes/phase': 'fix',
                '_goodvibes/attempt': payload.attempt,
              },
            )
            .catch(() => {});

          this._emitter
            .emitToolCallUpdate(payload.sessionId, toolCallId, 'in_progress', {
              '_goodvibes/phase': 'fix',
              '_goodvibes/attempt': payload.attempt,
            })
            .catch(() => {});
        }
      }),
    );

    // work-complete: mark work tool call as completed
    this._disposables.push(
      this.eventBus.on<WorkCompletePayload>('wrfc:work-complete', (event) => {
        const p = event.payload as WorkCompletePayload;
        const toolCallId = this._toolCallId(p.workId, 'work');
        this._emitter
          .emitToolCallUpdate(p.sessionId, toolCallId, 'completed', {
            '_goodvibes/phase': 'work',
            '_goodvibes/filesModified': p.filesModified.length,
          })
          .catch(() => {});
      }),
    );

    // review-complete: mark review tool call as completed
    this._disposables.push(
      this.eventBus.on<ReviewCompletePayload>('wrfc:review-complete', (event) => {
        const p = event.payload as ReviewCompletePayload;
        const toolCallId = this._toolCallId(p.workId, 'review');
        const status: acp.ToolCallStatus = p.passed ? 'completed' : 'failed';
        this._emitter
          .emitToolCallUpdate(p.sessionId, toolCallId, status, {
            '_goodvibes/phase': 'review',
            '_goodvibes/score': p.score,
            '_goodvibes/passed': p.passed,
          })
          .catch(() => {});
      }),
    );

    // fix-complete: mark fix tool call as completed
    this._disposables.push(
      this.eventBus.on<FixCompletePayload>('wrfc:fix-complete', (event) => {
        const p = event.payload as FixCompletePayload;
        const toolCallId = this._toolCallId(p.workId, 'fix');
        this._emitter
          .emitToolCallUpdate(p.sessionId, toolCallId, 'completed', {
            '_goodvibes/phase': 'fix',
            '_goodvibes/resolvedIssues': p.resolvedIssues.length,
          })
          .catch(() => {});
      }),
    );

    // chain-complete: clean up active tool call tracking
    this._disposables.push(
      this.eventBus.on<ChainCompletePayload>('wrfc:chain-complete', (event) => {
        const p = event.payload as ChainCompletePayload;
        // Remove all tracked tool calls for this workId
        for (const key of this._activeToolCalls.keys()) {
          if (key.startsWith(`${p.workId}:`)) {
            this._activeToolCalls.delete(key);
          }
        }
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
    this._activeToolCalls.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate a stable, deterministic tool call ID for a given work unit + phase.
   * The same workId+phase always returns the same ID within a session.
   */
  private _toolCallId(workId: string, phase: string): string {
    const key = `${workId}:${phase}`;
    let id = this._activeToolCalls.get(key);
    if (!id) {
      id = `wrfc_${phase}_${workId}`;
      this._activeToolCalls.set(key, id);
    }
    return id;
  }
}
