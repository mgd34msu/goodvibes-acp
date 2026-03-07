/**
 * @module lifecycle/health
 * @layer L2 — extensions, depends on L1 core
 *
 * Runtime health check. Reports the overall status of the GoodVibes ACP
 * runtime and tracks individual named checks contributed by other modules.
 */

import { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Aggregated runtime health snapshot */
export type HealthStatus = {
  /** Overall lifecycle phase */
  status: 'starting' | 'ready' | 'degraded' | 'shutting_down';
  /** Milliseconds since this HealthCheck instance was constructed */
  uptime: number;
  /** Named sub-checks contributed by other modules */
  checks: Record<string, { ok: boolean; message?: string }>;
};

// ---------------------------------------------------------------------------
// HealthCheck
// ---------------------------------------------------------------------------

/**
 * Tracks and exposes the runtime health status.
 *
 * Other modules may call `addCheck` to register named liveness probes that
 * are included in the `checks` map returned by `check()`.
 */
export class HealthCheck {
  private _status: HealthStatus['status'] = 'starting';
  private readonly _startedAt: number;
  private readonly _checks: Record<string, { ok: boolean; message?: string }> = {};
  private readonly _eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this._eventBus = eventBus;
    this._startedAt = Date.now();
  }

  /**
   * Returns a snapshot of the current runtime health.
   */
  check(): HealthStatus {
    return {
      status: this._deriveStatus(),
      uptime: Date.now() - this._startedAt,
      checks: { ...this._checks },
    };
  }

  /**
   * Mark the runtime as ready (all plugins have loaded successfully).
   * Transitions status from `starting` to `ready`.
   */
  markReady(): void {
    if (this._status === 'starting') {
      this._status = 'ready';
      this._eventBus.emit('lifecycle:health-ready', { uptime: Date.now() - this._startedAt });
    }
  }

  /**
   * Mark the runtime as shutting down.
   */
  markShuttingDown(): void {
    this._status = 'shutting_down';
    this._eventBus.emit('lifecycle:health-shutting-down', {});
  }

  /**
   * Register or update a named check.
   *
   * @param name    Unique identifier for this check.
   * @param ok      Whether the check is passing.
   * @param message Optional diagnostic message.
   */
  setCheck(name: string, ok: boolean, message?: string): void {
    this._checks[name] = { ok, message };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Derive the effective status, accounting for failed checks.
   * If any registered check is failing and the runtime is otherwise ready,
   * the status is `degraded`.
   */
  private _deriveStatus(): HealthStatus['status'] {
    if (this._status === 'shutting_down' || this._status === 'starting') {
      return this._status;
    }

    const hasFailing = Object.values(this._checks).some((c) => !c.ok);
    if (hasFailing) {
      return 'degraded';
    }

    return this._status;
  }
}
