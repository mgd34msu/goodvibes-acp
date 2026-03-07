/**
 * handlers.ts — WRFC event handlers
 *
 * L2 Extension — imports from L0 types and L1 core only.
 * Listens to WRFC state transition events from EventBus, creates directives
 * and emits notifications for each WRFC phase completion.
 */

import type { Directive } from '../../types/directive.js';
import type { WRFCState } from '../../types/wrfc.js';
import type { Disposable } from '../../core/event-bus.js';
import { EventBus } from '../../core/event-bus.js';
import { DirectiveQueue } from '../directives/queue.js';

// ---------------------------------------------------------------------------
// Handler options
// ---------------------------------------------------------------------------

export interface WRFCHandlerOptions {
  /**
   * Whether to automatically enqueue a 'review' directive when work completes.
   * Default: true.
   */
  autoEnqueueReview?: boolean;
  /**
   * Whether to automatically enqueue a 'fix' directive when a review fails.
   * Default: true.
   */
  autoEnqueueFix?: boolean;
}

// ---------------------------------------------------------------------------
// WRFCHandlers
// ---------------------------------------------------------------------------

/**
 * Subscribes to WRFC lifecycle events on the EventBus and bridges them to
 * the DirectiveQueue and notification events.
 *
 * Usage:
 * ```typescript
 * const handlers = new WRFCHandlers(eventBus, directiveQueue);
 * handlers.register();
 * // later:
 * handlers.unregister();
 * ```
 */
export class WRFCHandlers {
  private _subscriptions: Disposable[] = [];
  private readonly _opts: Required<WRFCHandlerOptions>;

  constructor(
    private readonly eventBus: EventBus,
    private readonly directiveQueue: DirectiveQueue,
    opts: WRFCHandlerOptions = {},
  ) {
    this._opts = {
      autoEnqueueReview: opts.autoEnqueueReview ?? true,
      autoEnqueueFix: opts.autoEnqueueFix ?? true,
    };
  }

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  /**
   * Subscribe to all WRFC events on the EventBus.
   * Idempotent — calling register() multiple times has no effect.
   */
  register(): void {
    if (this._subscriptions.length > 0) return;

    this._subscriptions = [
      this.eventBus.on('wrfc:state-changed', (event) =>
        this._onStateChanged(
          event.payload as { workId: string; sessionId: string; from: WRFCState; to: WRFCState; attempt: number },
        ),
      ),

      this.eventBus.on('wrfc:work-complete', (event) =>
        this._onWorkComplete(
          event.payload as { workId: string; sessionId: string; filesModified: string[] },
        ),
      ),

      this.eventBus.on('wrfc:review-complete', (event) =>
        this._onReviewComplete(
          event.payload as { workId: string; sessionId: string; score: number; passed: boolean },
        ),
      ),

      this.eventBus.on('wrfc:fix-complete', (event) =>
        this._onFixComplete(
          event.payload as { workId: string; sessionId: string; resolvedIssues: string[] },
        ),
      ),

      this.eventBus.on('wrfc:chain-complete', (event) =>
        this._onChainComplete(
          event.payload as { workId: string; sessionId: string; finalState: WRFCState; score?: number },
        ),
      ),

      this.eventBus.on('wrfc:cancelled', (event) =>
        this._onCancelled(
          event.payload as { workId: string; sessionId: string },
        ),
      ),
    ];
  }

  // -------------------------------------------------------------------------
  // unregister
  // -------------------------------------------------------------------------

  /**
   * Unsubscribe all WRFC event listeners.
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

  private _onStateChanged(payload: {
    workId: string;
    sessionId: string;
    from: WRFCState;
    to: WRFCState;
    attempt: number;
  }): void {
    const { workId, sessionId, from, to, attempt } = payload;

    this.eventBus.emit('wrfc:phase-changed', {
      workId,
      sessionId,
      from,
      to,
      attempt,
      timestamp: Date.now(),
    });
  }

  private _onWorkComplete(payload: {
    workId: string;
    sessionId: string;
    filesModified: string[];
  }): void {
    const { workId, sessionId, filesModified } = payload;

    this.eventBus.emit('wrfc:notification', {
      phase: 'work',
      workId,
      sessionId,
      message: `Work phase complete. ${filesModified.length} file(s) modified.`,
      timestamp: Date.now(),
    });

    if (this._opts.autoEnqueueReview) {
      const directive: Directive = {
        id: crypto.randomUUID(),
        action: 'review',
        workId,
        target: 'reviewer',
        priority: 'high',
        createdAt: Date.now(),
        meta: { sessionId, filesModified },
      };
      this.directiveQueue.enqueue(directive);
    }
  }

  private _onReviewComplete(payload: {
    workId: string;
    sessionId: string;
    score: number;
    passed: boolean;
  }): void {
    const { workId, sessionId, score, passed } = payload;

    this.eventBus.emit('wrfc:notification', {
      phase: 'review',
      workId,
      sessionId,
      message: `Review complete. Score: ${score.toFixed(1)}. ${passed ? 'PASSED' : 'FAILED'}.`,
      timestamp: Date.now(),
    });

    if (!passed && this._opts.autoEnqueueFix) {
      const directive: Directive = {
        id: crypto.randomUUID(),
        action: 'fix',
        workId,
        target: 'fixer',
        priority: 'high',
        createdAt: Date.now(),
        meta: { sessionId, score },
      };
      this.directiveQueue.enqueue(directive);
    }
  }

  private _onFixComplete(payload: {
    workId: string;
    sessionId: string;
    resolvedIssues: string[];
  }): void {
    const { workId, sessionId, resolvedIssues } = payload;

    this.eventBus.emit('wrfc:notification', {
      phase: 'fix',
      workId,
      sessionId,
      message: `Fix phase complete. ${resolvedIssues.length} issue(s) resolved.`,
      timestamp: Date.now(),
    });
  }

  private _onChainComplete(payload: {
    workId: string;
    sessionId: string;
    finalState: WRFCState;
    score?: number;
  }): void {
    const { workId, sessionId, finalState, score } = payload;

    const scoreStr = score !== undefined ? ` Score: ${score.toFixed(1)}.` : '';
    this.eventBus.emit('wrfc:notification', {
      phase: 'chain',
      workId,
      sessionId,
      message: `WRFC chain complete. Final state: ${finalState}.${scoreStr}`,
      timestamp: Date.now(),
    });

    const directive: Directive = {
      id: crypto.randomUUID(),
      action: 'complete',
      workId,
      priority: 'normal',
      createdAt: Date.now(),
      meta: { sessionId, finalState, score },
    };
    this.directiveQueue.enqueue(directive);
  }

  private _onCancelled(payload: { workId: string; sessionId: string }): void {
    const { workId, sessionId } = payload;

    this.eventBus.emit('wrfc:notification', {
      phase: 'cancelled',
      workId,
      sessionId,
      message: 'WRFC chain cancelled.',
      timestamp: Date.now(),
    });

    const directive: Directive = {
      id: crypto.randomUUID(),
      action: 'escalate',
      workId,
      priority: 'high',
      createdAt: Date.now(),
      meta: { sessionId, reason: 'cancelled' },
    };
    this.directiveQueue.enqueue(directive);
  }
}
