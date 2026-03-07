/**
 * event-bus.ts — Typed publish/subscribe event system
 *
 * L1 Core — imports only from L0 types and Bun/Node std lib.
 * Zero external npm dependencies.
 */

// L0 types note: L0 exports Event<T> (src/types/events.ts) which has a different shape
// from the L1 EventRecord<T> used internally here (L1 adds 'id' field and uses 'sessionId'
// at the record level). Keeping local definitions below.
// TODO: Align EventRecord shape with L0 Event<T> in a future refactor.

/** Represents a single recorded event in history */
export interface EventRecord<TPayload = unknown> {
  /** Unique event identifier (cuid-style, generated at emit time) */
  readonly id: string;
  /** Event type string (e.g., 'session:started', 'agent:completed') */
  readonly type: string;
  /** Event payload */
  readonly payload: TPayload;
  /** Timestamp when event was emitted (Date.now()) */
  readonly timestamp: number;
  /** Session ID if event is session-scoped (optional) */
  readonly sessionId?: string;
}

/** Handler function for an event */
export type EventHandler<TPayload = unknown> = (
  event: EventRecord<TPayload>
) => void | Promise<void>;

/** Predicate for filtered subscriptions */
export type EventPredicate<TPayload = unknown> = (
  event: EventRecord<TPayload>
) => boolean;

/** Disposable subscription handle — call dispose() to unsubscribe */
export interface Disposable {
  dispose(): void;
}

/** Options for EventBus construction */
export interface EventBusOptions {
  /** Maximum number of events to keep in history (default: 1000) */
  historyLimit?: number;
}

/**
 * Typed publish/subscribe event system.
 *
 * Features:
 * - Typed events via string event type keys
 * - Wildcard subscriptions ('*' matches all events, 'session:*' matches prefix)
 * - Async handlers — emit does NOT await them by default
 * - Event history ring buffer (configurable limit, default 1000)
 * - Disposable pattern for subscriptions
 * - Error isolation — handler errors emit an 'error' event instead of crashing the bus
 *
 * @example
 * ```typescript
 * const bus = new EventBus();
 * const sub = bus.on('session:started', (event) => {
 *   console.log('Session started:', event.payload);
 * });
 * bus.emit('session:started', { sessionId: 'abc' });
 * sub.dispose(); // unsubscribe
 * ```
 */
export class EventBus {
  private readonly _handlers = new Map<string, Set<EventHandler>>();
  private readonly _history: EventRecord[] = [];
  private readonly _historyLimit: number;
  private _destroyed = false;
  private _idCounter = 0;

  constructor(options: EventBusOptions = {}) {
    this._historyLimit = options.historyLimit ?? 1000;
  }

  /**
   * Subscribe to an event type.
   * Supports wildcards: '*' matches all events, 'prefix:*' matches any event starting with 'prefix:'.
   *
   * @param event - Event type string or wildcard pattern
   * @param handler - Async-compatible handler function
   * @returns Disposable handle to unsubscribe
   */
  on<TPayload = unknown>(
    event: string,
    handler: EventHandler<TPayload>
  ): Disposable {
    this._assertNotDestroyed();
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event)!.add(handler as EventHandler);
    return {
      dispose: () => this.off(event, handler as EventHandler),
    };
  }

  /**
   * Subscribe to an event type with a predicate filter.
   * Handler is only called when predicate returns true.
   * Used by L2 to implement session-scoped filtering.
   *
   * @param predicate - Filter function — handler only fires if this returns true
   * @param event - Event type string or wildcard pattern
   * @param handler - Async-compatible handler function
   * @returns Disposable handle to unsubscribe
   */
  onFiltered<TPayload = unknown>(
    predicate: EventPredicate<TPayload>,
    event: string,
    handler: EventHandler<TPayload>
  ): Disposable {
    this._assertNotDestroyed();
    const wrapped: EventHandler<TPayload> = (ev) => {
      if (predicate(ev)) {
        return handler(ev);
      }
    };
    return this.on(event, wrapped);
  }

  /**
   * Subscribe to an event type exactly once.
   * The handler is automatically unsubscribed after the first call.
   *
   * @param event - Event type string or wildcard pattern
   * @param handler - Async-compatible handler function
   * @returns Disposable handle to unsubscribe before it fires
   */
  once<TPayload = unknown>(
    event: string,
    handler: EventHandler<TPayload>
  ): Disposable {
    this._assertNotDestroyed();
    let disposed = false;
    const wrapped: EventHandler<TPayload> = (ev) => {
      if (!disposed) {
        disposed = true;
        this.off(event, wrapped as EventHandler);
        return handler(ev);
      }
    };
    return this.on(event, wrapped);
  }

  /**
   * Publish an event to all matching subscribers.
   * Handlers are called synchronously but their async results are NOT awaited.
   * Handler errors are caught and re-emitted as 'error' events.
   *
   * @param type - Event type string
   * @param payload - Event payload
   */
  emit<TPayload = unknown>(type: string, payload: TPayload): void {
    if (this._destroyed) return;

    const record: EventRecord<TPayload> = {
      id: this._nextId(),
      type,
      payload,
      timestamp: Date.now(),
      sessionId: (payload as Record<string, unknown>)?.sessionId as
        | string
        | undefined,
    };

    // Add to history ring buffer
    this._history.push(record as EventRecord);
    if (this._history.length > this._historyLimit) {
      this._history.shift();
    }

    // Collect matching handler sets
    const sets: Set<EventHandler>[] = [];

    // Exact match
    if (this._handlers.has(type)) {
      sets.push(this._handlers.get(type)!);
    }

    // Wildcard '*' — matches everything
    if (type !== '*' && this._handlers.has('*')) {
      sets.push(this._handlers.get('*')!);
    }

    // Prefix wildcards e.g. 'session:*' matches 'session:started'
    for (const [key, handlerSet] of this._handlers) {
      if (key !== type && key !== '*' && key.endsWith(':*')) {
        const prefix = key.slice(0, -1); // 'session:'
        if (type.startsWith(prefix)) {
          sets.push(handlerSet);
        }
      }
    }

    // Call all matched handlers — errors are isolated
    for (const set of sets) {
      for (const handler of set) {
        try {
          const result = handler(record as EventRecord);
          if (result instanceof Promise) {
            result.catch((err: unknown) => {
              this._emitError(type, err);
            });
          }
        } catch (err: unknown) {
          this._emitError(type, err);
        }
      }
    }
  }

  /**
   * Unsubscribe a handler from an event type.
   *
   * @param event - Event type string or wildcard pattern
   * @param handler - Handler to remove
   */
  off<TPayload = unknown>(event: string, handler: EventHandler<TPayload>): void {
    this._handlers.get(event)?.delete(handler as EventHandler);
  }

  /**
   * Retrieve event history.
   *
   * @param eventType - Optional filter by event type (exact match only, no wildcards)
   * @param limit - Maximum number of records to return (most recent first)
   * @returns Array of event records
   */
  history(eventType?: string, limit?: number): EventRecord[] {
    let results = eventType
      ? this._history.filter((r) => r.type === eventType)
      : [...this._history];

    if (limit !== undefined && limit > 0) {
      results = results.slice(-limit);
    }

    return results;
  }

  /**
   * Clear all subscriptions and history.
   * Does NOT destroy the bus — it can still be used after clear().
   */
  clear(): void {
    this._handlers.clear();
    this._history.length = 0;
  }

  /**
   * Destroy this event bus.
   * All subscriptions are removed and no further events will be processed.
   * Calling emit() on a destroyed bus is a no-op.
   */
  destroy(): void {
    this._handlers.clear();
    this._history.length = 0;
    this._destroyed = true;
  }

  /** Whether this bus has been destroyed */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /** Current number of event types with active subscriptions */
  get handlerCount(): number {
    let count = 0;
    for (const set of this._handlers.values()) {
      count += set.size;
    }
    return count;
  }

  // --- Private helpers ---

  private _nextId(): string {
    return `ev_${Date.now()}_${++this._idCounter}`;
  }

  private _emitError(sourceType: string, err: unknown): void {
    if (this._destroyed) return;
    // Avoid infinite recursion — don't emit error from within error handler
    if (sourceType === 'error') return;

    const errorPayload = {
      source: sourceType,
      error: err instanceof Error ? err : new Error(String(err)),
      timestamp: Date.now(),
    };

    const record: EventRecord = {
      id: this._nextId(),
      type: 'error',
      payload: errorPayload,
      timestamp: Date.now(),
    };

    this._history.push(record);
    if (this._history.length > this._historyLimit) {
      this._history.shift();
    }

    const errorHandlers = this._handlers.get('error');
    if (errorHandlers) {
      for (const handler of errorHandlers) {
        try {
          handler(record);
        } catch {
          // Swallow errors from error handlers to avoid infinite loops
        }
      }
    }
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('EventBus has been destroyed');
    }
  }
}
