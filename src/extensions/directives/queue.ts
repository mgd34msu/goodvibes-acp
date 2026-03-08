/**
 * @module directives/queue
 * @layer L2 — extends L1 core with directive intake, priority ordering,
 *             target-based filtering, and drain semantics.
 *
 * Builds on the L1 generic Queue for storage and the L1 EventBus for
 * directive lifecycle events.
 */

import type {
  Directive,
  DirectiveFilter,
  DirectiveResult,
} from '../../types/directive.js';
import type { DirectivePriority } from '../../types/directive.js';
import { Queue } from '../../core/queue.js';
import { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// Priority helpers
// ---------------------------------------------------------------------------

/** Numeric weight for each priority level — higher = dequeued first */
const PRIORITY_WEIGHT: Record<DirectivePriority, number> = {
  critical: 3,
  high: 2,
  normal: 1,
  low: 0,
};

/** Return true if `candidate` meets or exceeds `min` */
function meetsMinPriority(
  candidate: DirectivePriority,
  min: DirectivePriority,
): boolean {
  return PRIORITY_WEIGHT[candidate] >= PRIORITY_WEIGHT[min];
}

// ---------------------------------------------------------------------------
// Filter helper
// ---------------------------------------------------------------------------

/**
 * Build a predicate that returns true when a directive matches all fields
 * specified in the filter (AND semantics).
 */
function buildPredicate(
  filter: DirectiveFilter,
): (directive: Directive) => boolean {
  return (directive: Directive): boolean => {
    if (filter.action !== undefined && directive.action !== filter.action) {
      return false;
    }
    if (filter.workId !== undefined && directive.workId !== filter.workId) {
      return false;
    }
    if (filter.sessionId !== undefined && directive.sessionId !== filter.sessionId) {
      return false;
    }
    if (filter.target !== undefined && directive.target !== filter.target) {
      return false;
    }
    if (
      filter.minPriority !== undefined &&
      !meetsMinPriority(directive.priority, filter.minPriority)
    ) {
      return false;
    }
    return true;
  };
}

// ---------------------------------------------------------------------------
// DirectiveQueue
// ---------------------------------------------------------------------------

/**
 * Priority-ordered directive queue built on the L1 generic Queue.
 *
 * Directives are stored in priority order (critical > high > normal > low).
 * Within the same priority level, FIFO ordering is preserved.
 *
 * Lifecycle events are broadcast on the L1 EventBus:
 * - `directive:enqueued`  — a directive was added
 * - `directive:processed` — a directive finished processing
 * - `directive:cleared`   — the queue was cleared
 */
export class DirectiveQueue {
  private readonly _queue: Queue<Directive>;
  private readonly _bus: EventBus;
  /** Guard flag — true while process() is executing */
  private _processing = false;
  /** Buffer for directives enqueued during an active process() call */
  private _pending: Directive[] = [];

  constructor(eventBus: EventBus) {
    this._queue = new Queue<Directive>();
    this._bus = eventBus;
  }

  // -------------------------------------------------------------------------
  // enqueue
  // -------------------------------------------------------------------------

  /**
   * Add a directive to the queue.
   * The directive is inserted in priority order (critical first).
   * Emits `directive:enqueued`.
   *
   * @param directive - Directive to enqueue
   */
  enqueue(directive: Directive): void {
    if (this._processing) {
      // Buffer directives that arrive during an active process() call so they
      // are not lost and are drained at the end of the current processing cycle.
      this._pending.push(directive);
    } else {
      this._queue.enqueue(directive, PRIORITY_WEIGHT[directive.priority]);
    }
    this._bus.emit('directive:enqueued', { directiveId: directive.id, action: directive.action, priority: directive.priority });
  }

  // -------------------------------------------------------------------------
  // dequeue
  // -------------------------------------------------------------------------

  /**
   * Remove and return the highest-priority directive.
   *
   * @returns The next directive, or undefined if the queue is empty
   */
  dequeue(): Directive | undefined {
    return this._queue.dequeue();
  }

  // -------------------------------------------------------------------------
  // drain
  // -------------------------------------------------------------------------

  /**
   * Remove and return all directives matching the optional filter.
   * When no filter is provided, all directives are drained.
   * Results are returned in priority order (highest first).
   *
   * @param filter - Optional filter; all specified fields must match (AND)
   * @returns Drained directives in priority order
   */
  drain(filter?: DirectiveFilter): Directive[] {
    if (filter === undefined) {
      return this._queue.drain();
    }
    return this._queue.remove(buildPredicate(filter));
  }

  // -------------------------------------------------------------------------
  // peek
  // -------------------------------------------------------------------------

  /**
   * Return the next directive without removing it.
   *
   * @returns The next directive, or undefined if the queue is empty
   */
  peek(): Directive | undefined {
    return this._queue.peek();
  }

  // -------------------------------------------------------------------------
  // pending
  // -------------------------------------------------------------------------

  /**
   * Return all directives matching the optional filter without removing them.
   * When no filter is provided, all directives are returned.
   *
   * @param filter - Optional filter; all specified fields must match (AND)
   * @returns Matching directives in priority order
   */
  pending(filter?: DirectiveFilter): Directive[] {
    if (filter === undefined) {
      return this._queue.filter(() => true);
    }
    return this._queue.filter(buildPredicate(filter));
  }

  // -------------------------------------------------------------------------
  // size
  // -------------------------------------------------------------------------

  /**
   * Return the total number of queued directives.
   *
   * @returns Queue size
   */
  size(): number {
    return this._queue.size();
  }

  // -------------------------------------------------------------------------
  // clear
  // -------------------------------------------------------------------------

  /**
   * Remove all directives from the queue.
   * Emits `directive:cleared`.
   */
  clear(): void {
    this._queue.clear();
    this._bus.emit('directive:cleared', {});
  }

  // -------------------------------------------------------------------------
  // process
  // -------------------------------------------------------------------------

  /**
   * Drain all directives and invoke the handler for each in priority order.
   * Emits `directive:processed` for every directive after the handler resolves
   * or rejects.
   *
   * The handler is called sequentially — each directive is awaited before
   * the next is processed.
   *
   * @param handler - Async function called with each directive
   * @returns Array of results in the order they were processed
   */
  async process(
    handler: (directive: Directive) => Promise<DirectiveResult>,
  ): Promise<DirectiveResult[]> {
    if (this._processing) {
      console.warn('[DirectiveQueue] process() skipped — already processing (reentrancy guard)');
      return []; // prevent reentrancy
    }
    this._processing = true;
    const results: DirectiveResult[] = [];

    try {
      while (this._queue.size() > 0) {
        const directive = this._queue.dequeue()!;
        let result: DirectiveResult;

        try {
          result = await handler(directive);
        } catch (err) {
          result = {
            directive,
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            processedAt: Date.now(),
          };
        }

        results.push(result);
        this._bus.emit('directive:processed', {
          directiveId: directive.id,
          status: result.status,
          processedAt: result.processedAt,
        });

        // Drain any directives that were buffered during handler execution
        if (this._pending.length > 0) {
          for (const pending of this._pending) {
            this._queue.enqueue(pending, PRIORITY_WEIGHT[pending.priority]);
          }
          this._pending = [];
        }
      }
    } finally {
      this._processing = false;
    }

    return results;
  }
}
