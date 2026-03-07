/**
 * @module external/normalizer
 * @layer L2 — extensions, imports from L0 and L1 only
 *
 * Pluggable per-source event normalizer registry.
 * Transforms raw webhook/external payloads into a canonical NormalizedEvent
 * shape before they are emitted onto the EventBus.
 */

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Canonical normalized event produced by any registered normalizer.
 */
export interface NormalizedEvent {
  /** Source identifier (e.g. 'github', 'slack', 'generic') */
  source: string;
  /** Event type string derived from the payload (e.g. 'push', 'message') */
  type: string;
  /** Normalized payload — all values coerced to a plain record */
  payload: Record<string, unknown>;
  /** Unix timestamp (ms) when normalization occurred */
  timestamp: number;
  /** Unique event ID */
  id: string;
}

/**
 * Interface that every source-specific normalizer must implement.
 */
export interface EventNormalizer {
  /**
   * Transform a raw payload from a specific source into a NormalizedEvent.
   *
   * @param payload  Raw, untyped payload received from the external source.
   * @returns        NormalizedEvent — the canonical internal representation.
   */
  normalize(payload: unknown): NormalizedEvent;
}

// ---------------------------------------------------------------------------
// Built-in normalizers
// ---------------------------------------------------------------------------

/**
 * Generic passthrough normalizer.
 *
 * Wraps any payload verbatim and derives a minimal event type string.
 * Used as the fallback when no source-specific normalizer is registered.
 */
class GenericNormalizer implements EventNormalizer {
  normalize(payload: unknown): NormalizedEvent {
    const raw =
      payload !== null && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : { value: payload };

    // Best-effort type extraction: look for common "type"/"event"/"action" keys
    const type =
      typeof raw['type'] === 'string'
        ? raw['type']
        : typeof raw['event'] === 'string'
          ? raw['event']
          : typeof raw['action'] === 'string'
            ? raw['action']
            : 'unknown';

    return {
      source: 'generic',
      type,
      payload: raw,
      timestamp: Date.now(),
      id: randomUUID(),
    };
  }
}

// ---------------------------------------------------------------------------
// NormalizerRegistry
// ---------------------------------------------------------------------------

/**
 * Registry of per-source event normalizers.
 *
 * Callers register source-specific normalizers at startup; the runtime calls
 * `normalize(source, payload)` when a webhook arrives.
 *
 * A built-in 'generic' normalizer is always present as the fallback.
 *
 * @example
 * ```typescript
 * const registry = new NormalizerRegistry();
 * registry.register('github', new GitHubNormalizer());
 * const event = registry.normalize('github', webhookBody);
 * bus.emit('external:event', event);
 * ```
 */
export class NormalizerRegistry {
  private readonly _normalizers = new Map<string, EventNormalizer>();

  constructor() {
    // Built-in fallback always available
    this._normalizers.set('generic', new GenericNormalizer());
  }

  /**
   * Register a normalizer for the given source name.
   * Overwrites any previously registered normalizer for that source.
   *
   * @param source      Identifier matching the `:source` route parameter.
   * @param normalizer  Normalizer instance to register.
   */
  register(source: string, normalizer: EventNormalizer): void {
    this._normalizers.set(source, normalizer);
  }

  /**
   * Normalize a raw payload for the given source.
   *
   * Falls back to the 'generic' normalizer when no source-specific
   * normalizer is registered.  The returned NormalizedEvent always has
   * its `source` field set to the requested `source` string so that
   * downstream consumers can identify origin even when the generic
   * normalizer is used.
   *
   * @param source   Source identifier (e.g. 'github').
   * @param payload  Raw payload to normalize.
   * @returns        NormalizedEvent ready for EventBus emission.
   */
  normalize(source: string, payload: unknown): NormalizedEvent {
    const normalizer =
      this._normalizers.get(source) ?? this._normalizers.get('generic')!;
    const event = normalizer.normalize(payload);
    // Ensure source is always the requested source, not 'generic'
    return { ...event, source };
  }

  /**
   * Returns whether a source-specific normalizer (non-generic) has been
   * registered for `source`.
   */
  has(source: string): boolean {
    return this._normalizers.has(source) && source !== 'generic';
  }

  /** List all registered source names (including 'generic'). */
  sources(): string[] {
    return Array.from(this._normalizers.keys());
  }
}

// ---------------------------------------------------------------------------
// ACP adapter — L1 → L2 bridge helper
// ---------------------------------------------------------------------------

/**
 * Converts a {@link NormalizedEvent} (L1 internal shape) into the ACP-compatible
 * extension event envelope used by the `_goodvibes/events` JSON-RPC notification.
 *
 * This adapter is the boundary between the L1 generic ingestion layer and the
 * L2 ACP session notification pipeline.  The L2 layer should subscribe to
 * `EventBus.on('external:event', ...)` and call this function before forwarding
 * to the ACP transport.
 *
 * @param event  A normalized event produced by {@link NormalizerRegistry}.
 * @returns      An ACP-compatible JSON-RPC notification params object.
 *
 * @example
 * ```typescript
 * eventBus.on('external:event', (event: NormalizedEvent) => {
 *   const acpEnvelope = toAcpExtensionEvent(event);
 *   session.sendNotification('_goodvibes/events', acpEnvelope);
 * });
 * ```
 */
export function toAcpExtensionEvent(event: NormalizedEvent): Record<string, unknown> {
  return {
    method: '_goodvibes/events',
    params: {
      source: event.source,
      type: event.type,
      payload: event.payload,
      timestamp: event.timestamp,
      eventId: event.id,
    },
  };
}
