/**
 * @module lifecycle/shutdown
 * @layer L2 — extensions, depends on L1 core and L0 types
 *
 * Graceful shutdown manager. Tears down in reverse layer order (L3 → L2 → L1)
 * by sorting handlers by descending order value.
 */

import { EventBus } from '../../core/event-bus.js';
import type { PluginRegistration } from '../../types/plugin.js';

/** Order constants by layer */
export const SHUTDOWN_ORDER = {
  L3: 300,
  L2: 200,
  L1: 100,
} as const;

/** Default per-handler timeout in milliseconds */
const HANDLER_TIMEOUT_MS = 10_000;

/** Internal handler entry */
interface HandlerEntry {
  name: string;
  order: number;
  handler: () => Promise<void>;
}

/**
 * Manages graceful shutdown of all runtime layers.
 *
 * Handlers are executed in descending `order` (highest first), which maps to
 * L3 plugins (300) → L2 extensions (200) → L1 core (100).
 */
export class ShutdownManager {
  private _handlers: HandlerEntry[] = [];
  private _isShuttingDown: boolean = false;
  private readonly _eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this._eventBus = eventBus;
  }

  /**
   * Register a shutdown handler.
   *
   * @param name    Human-readable name for logging.
   * @param order   Priority order. Higher = runs first. Use SHUTDOWN_ORDER constants.
   * @param handler Async cleanup function.
   */
  register(name: string, order: number, handler: () => Promise<void>): void {
    this._handlers.push({ name, order, handler });
    // Keep sorted descending so iteration is always in correct order
    this._handlers.sort((a, b) => b.order - a.order);
  }

  /**
   * Execute all shutdown handlers in descending order with a per-handler timeout.
   *
   * @param reason Optional human-readable reason for the shutdown.
   */
  async shutdown(reason?: string): Promise<void> {
    if (this._isShuttingDown) {
      return;
    }
    this._isShuttingDown = true;

    this._eventBus.emit('lifecycle:shutdown-start', { reason });

    for (const entry of this._handlers) {
      await this._runWithTimeout(entry);
    }

    this._eventBus.emit('lifecycle:shutdown-complete', { reason });
  }

  /** Returns true while shutdown is in progress. */
  isShuttingDown(): boolean {
    return this._isShuttingDown;
  }

  /**
   * Convenience helper: register a plugin's shutdown handler at L3 order (300).
   *
   * @param plugin Plugin registration object.
   */
  registerPlugin(plugin: PluginRegistration): void {
    if (!plugin.shutdown) {
      return;
    }
    this.register(
      plugin.manifest.name,
      SHUTDOWN_ORDER.L3,
      plugin.shutdown.bind(plugin),
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async _runWithTimeout(entry: HandlerEntry): Promise<void> {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<void>((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error(`Shutdown handler "${entry.name}" timed out after ${HANDLER_TIMEOUT_MS}ms`)),
        HANDLER_TIMEOUT_MS,
      );
    });

    try {
      await Promise.race([entry.handler(), timeoutPromise]);
    } catch (err) {
      // Log warning but do not abort — proceed with remaining handlers
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[ShutdownManager] Warning during shutdown of "${entry.name}": ${message}`);
    } finally {
      clearTimeout(timerId);
    }
  }

  // ---------------------------------------------------------------------------
  // ACP session cleanup
  // ---------------------------------------------------------------------------

  /**
   * TODO (ISS-074): Register an L2 handler that closes active ACP sessions on shutdown.
   *
   * When an in-flight ACP prompt is interrupted by shutdown, the runtime should
   * send a `finish` event with `stopReason: 'cancelled'` for each active session
   * before the process exits. This requires access to the ACP session registry
   * (e.g. via the EventBus or a direct registry reference) and should be
   * registered at SHUTDOWN_ORDER.L2 (200) so it runs after L3 plugins but
   * before L1 core teardown.
   *
   * Example registration point:
   *   shutdownManager.register('acp-sessions', SHUTDOWN_ORDER.L2, async () => {
   *     for (const session of acpSessionRegistry.activeSessions()) {
   *       await session.finish({ stopReason: 'cancelled' });
   *     }
   *   });
   */
}
