/**
 * @module acp/event-recorder
 * @layer L2 — ACP protocol layer
 *
 * EventRecorder — subscribes to all events on the EventBus and maintains a
 * bounded circular buffer for _goodvibes/events queries.
 */

import type { Disposable } from '../../core/event-bus.js';
import { EventBus } from '../../core/event-bus.js';

/** A single recorded event entry */
export type RecordedEvent = {
  type: string;
  timestamp: number;
  sessionId?: string;
  data: unknown;
};

/**
 * Records recent events for _goodvibes/events queries.
 *
 * Maintains a circular buffer of up to `maxEvents` entries. When the buffer
 * is full, the oldest entry is evicted to make room for the newest.
 */
export class EventRecorder {
  private readonly _events: RecordedEvent[] = [];
  private readonly _maxEvents: number;
  private _subscription: Disposable | null = null;

  constructor(
    private readonly _eventBus: EventBus,
    maxEvents = 1000,
  ) {
    this._maxEvents = maxEvents;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start recording — subscribe to all events on the bus.
   * Safe to call multiple times; subsequent calls are no-ops.
   */
  register(): void {
    if (this._subscription !== null) return;

    this._subscription = this._eventBus.on<Record<string, unknown>>(
      '*',
      (event) => {
        const entry: RecordedEvent = {
          type: event.type,
          timestamp: event.timestamp,
          ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
          data: event.payload,
        };

        if (this._events.length >= this._maxEvents) {
          // Evict oldest entry (circular buffer behaviour)
          this._events.shift();
        }
        this._events.push(entry);
      },
    );
  }

  /**
   * Stop recording — unsubscribe from the bus.
   * Safe to call multiple times; subsequent calls are no-ops.
   */
  unregister(): void {
    if (this._subscription === null) return;
    this._subscription.dispose();
    this._subscription = null;
  }

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  /**
   * Return recorded events, optionally filtered by type and/or sessionId.
   *
   * @param filter.type      - Exact event type to match (e.g. "session:created")
   * @param filter.sessionId - Session to filter by
   * @param filter.limit     - Maximum entries to return (most recent first)
   */
  query(filter?: {
    type?: string;
    sessionId?: string;
    limit?: number;
  }): RecordedEvent[] {
    let results = this._events.slice(); // copy

    if (filter?.type !== undefined) {
      const t = filter.type;
      results = results.filter((e) => e.type === t);
    }

    if (filter?.sessionId !== undefined) {
      const sid = filter.sessionId;
      results = results.filter((e) => e.sessionId === sid);
    }

    // Return most recent first
    results = results.reverse();

    if (filter?.limit !== undefined && filter.limit > 0) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }
}
