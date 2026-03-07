/**
 * @module external
 * @layer L1 — Generic event ingestion infrastructure
 * @status awaiting-integration
 *
 * Provides HTTP webhook listener and file-system watcher that normalize
 * external events into a common NormalizedEvent shape. Currently not wired
 * into the ACP session notification pipeline.
 *
 * Integration path:
 *   1. NormalizedEvent → EventBus.emit('external:event', normalized)
 *   2. ACP layer subscribes and converts to _goodvibes/events notification
 *   3. See ISS-062/063 for full integration spec
 */

import type { EventBus } from '../../core/event-bus.js';
import type { NormalizedEvent } from './normalizer.js';
import type { FileChangedPayload } from './file-watcher.js';

export * from './http-listener.js';
export * from './file-watcher.js';
export * from './normalizer.js';

// ---------------------------------------------------------------------------
// ExternalEventBridge — L1 → EventBus bridge
// ---------------------------------------------------------------------------

/**
 * Bridges the external event sources (HTTP webhooks, file-system watcher) into
 * the shared EventBus under the unified `external:event` channel.
 *
 * Subscribes to the raw per-source event channels emitted by HttpListener and
 * FileWatcher and re-emits every payload as `external:event` so that an L2 ACP
 * layer can subscribe to a single well-known channel.
 *
 * @example
 * ```typescript
 * const bridge = new ExternalEventBridge(eventBus);
 * bridge.attach();
 * // Later:
 * bridge.detach();
 * ```
 */
export class ExternalEventBridge {
  private readonly _bus: EventBus;
  private readonly _disposables: Array<{ dispose(): void }> = [];

  constructor(eventBus: EventBus) {
    this._bus = eventBus;
  }

  /**
   * Subscribe to all raw external event channels and forward payloads as
   * `external:event` on the shared EventBus.
   *
   * Calling `attach()` more than once is a no-op — subsequent calls are ignored
   * until `detach()` is called.
   */
  attach(): void {
    if (this._disposables.length > 0) return;

    // Forward HTTP webhook events
    this._disposables.push(
      this._bus.on<NormalizedEvent>('external:webhook', (event) => {
        this._bus.emit('external:event', event.payload);
      })
    );

    // Forward file-watcher events as a NormalizedEvent-compatible shape
    this._disposables.push(
      this._bus.on<FileChangedPayload>('external:file-changed', (event) => {
        const p = event.payload;
        const normalized: NormalizedEvent = {
          source: 'file-watcher',
          type: p.changeType ?? 'modified',
          payload: { path: p.path },
          timestamp: p.timestamp ?? Date.now(),
          id: `fw-${p.timestamp ?? Date.now()}-${p.path}`,
        };
        this._bus.emit('external:event', normalized);
      })
    );
  }

  /**
   * Unsubscribe all forwarding handlers registered by `attach()`.
   */
  detach(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables.length = 0;
  }

  /** Whether the bridge is currently attached (forwarding events). */
  get isAttached(): boolean {
    return this._disposables.length > 0;
  }
}
