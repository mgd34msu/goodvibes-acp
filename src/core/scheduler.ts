/**
 * scheduler.ts — Generic task scheduling
 *
 * L1 Core — imports only from L0 types and Bun/Node std lib.
 * Zero external npm dependencies.
 */

import type { Disposable } from './event-bus.js';

/** Configuration for a scheduled task */
export interface ScheduleConfig {
  /** Task handler function — called on each scheduled invocation */
  handler: () => void | Promise<void>;
  /** Interval in milliseconds for recurring tasks */
  intervalMs?: number;
  /** Maximum number of concurrent executions (default: 1) */
  maxConcurrent?: number;
  /** Whether to run immediately on schedule (before first interval) */
  runImmediately?: boolean;
}

/** Task execution status */
export type TaskStatus = 'scheduled' | 'running' | 'paused' | 'cancelled';

/** A scheduled task instance */
export interface ScheduledTask {
  /** Unique task identifier */
  readonly id: string;
  /** Task configuration */
  readonly config: ScheduleConfig;
  /** Current status */
  status: TaskStatus;
  /** Timestamp of last execution (null if never run) */
  lastRun: number | null;
  /** Timestamp of next scheduled execution (null if paused/cancelled) */
  nextRun: number | null;
  /** Number of times the task has been executed */
  runCount: number;
  /** Number of currently active concurrent executions */
  activeCount: number;
}

/**
 * Generic task scheduling system.
 *
 * Features:
 * - Interval-based tasks (every N ms)
 * - Task lifecycle: scheduled → running → completed → scheduled (loop)
 * - Concurrent execution limit per task
 * - Pause/resume individual tasks
 * - Clean shutdown via destroy()
 *
 * @example
 * ```typescript
 * const scheduler = new Scheduler();
 * scheduler.schedule('heartbeat', {
 *   handler: async () => { await sendHeartbeat(); },
 *   intervalMs: 30000,
 * });
 * // ... later:
 * scheduler.pause('heartbeat');
 * scheduler.resume('heartbeat');
 * scheduler.destroy(); // cancels all
 * ```
 */
export class Scheduler {
  private readonly _tasks = new Map<string, ScheduledTask>();
  private readonly _timers = new Map<string, ReturnType<typeof setInterval>>();
  private _destroyed = false;

  /**
   * Schedule a task.
   *
   * @param id - Unique task identifier
   * @param config - Task configuration
   * @throws Error if a task with the same id already exists
   */
  schedule(id: string, config: ScheduleConfig): void {
    this._assertNotDestroyed();
    if (this._tasks.has(id)) {
      throw new Error(`Scheduler: task '${id}' is already scheduled. Cancel it first.`);
    }

    const intervalMs = config.intervalMs ?? 60000;
    const task: ScheduledTask = {
      id,
      config,
      status: 'scheduled',
      lastRun: null,
      nextRun: Date.now() + intervalMs,
      runCount: 0,
      activeCount: 0,
    };
    this._tasks.set(id, task);

    if (config.runImmediately) {
      this._execute(task);
    }

    const timer = setInterval(() => {
      if (!this._destroyed) {
        this._execute(task);
      }
    }, intervalMs);

    this._timers.set(id, timer);
    task.nextRun = Date.now() + intervalMs;
  }

  /**
   * Cancel a scheduled task.
   * Cancellation is immediate; any in-progress execution will complete.
   *
   * @param id - Task identifier
   */
  cancel(id: string): void {
    const timer = this._timers.get(id);
    if (timer !== undefined) {
      clearInterval(timer);
      this._timers.delete(id);
    }
    const task = this._tasks.get(id);
    if (task) {
      task.status = 'cancelled';
      task.nextRun = null;
    }
    this._tasks.delete(id);
  }

  /**
   * Pause a scheduled task.
   * The timer is cleared; the task won't run until resumed.
   *
   * @param id - Task identifier
   */
  pause(id: string): void {
    this._assertNotDestroyed();
    const task = this._tasks.get(id);
    if (!task || task.status === 'cancelled') return;

    const timer = this._timers.get(id);
    if (timer !== undefined) {
      clearInterval(timer);
      this._timers.delete(id);
    }
    task.status = 'paused';
    task.nextRun = null;
  }

  /**
   * Resume a paused task.
   * Restarts the interval timer.
   *
   * @param id - Task identifier
   */
  resume(id: string): void {
    this._assertNotDestroyed();
    const task = this._tasks.get(id);
    if (!task || task.status !== 'paused') return;

    const intervalMs = task.config.intervalMs ?? 60000;
    task.status = 'scheduled';
    task.nextRun = Date.now() + intervalMs;

    const timer = setInterval(() => {
      if (!this._destroyed) {
        this._execute(task);
      }
    }, intervalMs);
    this._timers.set(id, timer);
  }

  /**
   * List all scheduled tasks.
   *
   * @returns Array of task info objects (includes cancelled tasks until garbage collected)
   */
  list(): ScheduledTask[] {
    return Array.from(this._tasks.values());
  }

  /**
   * Get a specific task by ID.
   *
   * @param id - Task identifier
   * @returns Task info, or undefined if not found
   */
  getTask(id: string): ScheduledTask | undefined {
    return this._tasks.get(id);
  }

  /**
   * Destroy the scheduler. All timers are cancelled.
   * In-progress executions will complete naturally.
   */
  destroy(): void {
    for (const [, timer] of this._timers) {
      clearInterval(timer);
    }
    this._timers.clear();
    for (const task of this._tasks.values()) {
      task.status = 'cancelled';
      task.nextRun = null;
    }
    this._tasks.clear();
    this._destroyed = true;
  }

  // --- Private helpers ---

  private _execute(task: ScheduledTask): void {
    if (task.status === 'paused' || task.status === 'cancelled') return;

    const maxConcurrent = task.config.maxConcurrent ?? 1;
    if (task.activeCount >= maxConcurrent) return;

    task.status = 'running';
    task.activeCount++;
    task.lastRun = Date.now();
    task.runCount++;

    const intervalMs = task.config.intervalMs ?? 60000;

    const done = () => {
      task.activeCount--;
      if (task.activeCount === 0 && task.status !== 'cancelled' && task.status !== 'paused') {
        task.status = 'scheduled';
        task.nextRun = Date.now() + intervalMs;
      }
    };

    try {
      const result = task.config.handler();
      if (result instanceof Promise) {
        result.then(done).catch(() => done());
      } else {
        done();
      }
    } catch {
      done();
    }
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('Scheduler has been destroyed');
    }
  }

  /** Create a Disposable that cancels the task when disposed */
  getDisposable(id: string): Disposable {
    return {
      dispose: () => this.cancel(id),
    };
  }
}
