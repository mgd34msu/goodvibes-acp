/**
 * queue.ts — Generic FIFO queue with priority support
 *
 * L1 Core — imports only from L0 types and Bun/Node std lib.
 * Zero external npm dependencies.
 */

/** An internal queue entry with priority metadata */
interface QueueEntry<T> {
  /** The queued item */
  readonly item: T;
  /** Priority — higher values dequeued first (default: 0) */
  readonly priority: number;
  /** Insertion sequence number for FIFO ordering within same priority */
  readonly seq: number;
}

/** Serialized format for a Queue */
export interface SerializedQueue<T> {
  /** Schema version for migration support */
  $schema: string;
  /** Serialized entries (seq numbers may be re-assigned on restore) */
  entries: Array<{ item: T; priority: number }>;
  /** Timestamp of serialization */
  timestamp: string;
}

const QUEUE_SCHEMA_VERSION = '1.0.0';

/**
 * Generic FIFO queue with priority support.
 *
 * Features:
 * - Priority support: higher priority items dequeued first (default priority: 0)
 * - FIFO ordering within same priority level
 * - Filter and remove operations for targeted queue management
 * - Serializable to/from JSON with $schema versioning
 * - Generic — no domain knowledge
 *
 * @example
 * ```typescript
 * const queue = new Queue<string>();
 * queue.enqueue('task-a');
 * queue.enqueue('urgent-task', 10); // higher priority
 * queue.dequeue(); // 'urgent-task' (dequeued first due to priority)
 * queue.dequeue(); // 'task-a'
 * ```
 */
export class Queue<T> {
  private readonly _entries: QueueEntry<T>[] = [];
  private _seqCounter = 0;

  /**
   * Add an item to the queue.
   * Items with higher priority are dequeued before lower priority items.
   * Items with the same priority are dequeued in FIFO order.
   *
   * @param item - Item to enqueue
   * @param priority - Priority level (default: 0). Higher = dequeued first.
   */
  enqueue(item: T, priority = 0): void {
    const entry: QueueEntry<T> = {
      item,
      priority,
      seq: this._seqCounter++,
    };
    // Insert in sorted position for efficient dequeue using binary search
    // Higher priority first; same priority: lower seq first (FIFO)
    let low = 0, high = this._entries.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const existing = this._entries[mid];
      if (
        existing.priority > entry.priority ||
        (existing.priority === entry.priority && existing.seq < entry.seq)
      ) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    this._entries.splice(low, 0, entry);
  }

  /**
   * Remove and return the highest-priority item from the front of the queue.
   *
   * @returns The next item, or undefined if the queue is empty
   */
  dequeue(): T | undefined {
    const entry = this._entries.shift();
    return entry?.item;
  }

  /**
   * Return the next item without removing it.
   *
   * @returns The next item, or undefined if the queue is empty
   */
  peek(): T | undefined {
    return this._entries[0]?.item;
  }

  /**
   * Remove and return all items in priority order.
   *
   * @returns Array of all items (highest priority first)
   */
  drain(): T[] {
    const items = this._entries.map((e) => e.item);
    this._entries.length = 0;
    return items;
  }

  /**
   * Return items matching a predicate without removing them.
   *
   * @param predicate - Filter function
   * @returns Array of matching items
   */
  filter(predicate: (item: T) => boolean): T[] {
    return this._entries
      .filter((e) => predicate(e.item))
      .map((e) => e.item);
  }

  /**
   * Remove all items matching a predicate from the queue.
   *
   * @param predicate - Items for which this returns true are removed
   * @returns Array of removed items
   */
  remove(predicate: (item: T) => boolean): T[] {
    const removed: T[] = [];
    for (let i = this._entries.length - 1; i >= 0; i--) {
      if (predicate(this._entries[i].item)) {
        removed.unshift(this._entries.splice(i, 1)[0].item);
      }
    }
    return removed;
  }

  /**
   * Get the number of items in the queue.
   *
   * @returns Queue size
   */
  size(): number {
    return this._entries.length;
  }

  /**
   * Check if the queue is empty.
   *
   * @returns true if the queue has no items
   */
  isEmpty(): boolean {
    return this._entries.length === 0;
  }

  /**
   * Remove all items from the queue.
   */
  clear(): void {
    this._entries.length = 0;
  }

  /**
   * Serialize the queue for persistence.
   *
   * @returns Serialized queue with $schema versioning
   */
  serialize(): SerializedQueue<T> {
    return {
      $schema: QUEUE_SCHEMA_VERSION,
      entries: this._entries.map((e) => ({ item: e.item, priority: e.priority })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Restore a queue from serialized data.
   * Creates a new Queue and enqueues items in serialized order.
   *
   * @param data - Serialized data from serialize()
   * @returns Restored Queue instance
   */
  static restore<T>(data: SerializedQueue<T>): Queue<T> {
    const queue = new Queue<T>();
    for (const { item, priority } of data.entries) {
      queue.enqueue(item, priority);
    }
    return queue;
  }
}
