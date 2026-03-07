/**
 * versioned-store.ts — Utility for versioned JSON persistence
 *
 * Wraps arbitrary data with a semver schema tag for forward-compatible
 * serialisation. Consumers can check the version before deserialising to
 * handle migrations gracefully.
 *
 * @layer L1 Core — no external dependencies, pure utility
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A versioned data envelope. Wraps any serialisable value with a semver tag. */
export type VersionedData<T> = {
  /** Semver string identifying the schema version (e.g. "1.0.0") */
  $schema: string;
  /** The wrapped data payload */
  data: T;
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Type guard — returns true when `raw` is a {@link VersionedData} envelope.
 * Does NOT validate the schema string or the data shape.
 */
export function isVersioned(raw: unknown): raw is VersionedData<unknown> {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    '$schema' in raw &&
    typeof (raw as Record<string, unknown>)['$schema'] === 'string' &&
    'data' in raw
  );
}

// ---------------------------------------------------------------------------
// Wrap / unwrap
// ---------------------------------------------------------------------------

/**
 * Wrap `data` in a {@link VersionedData} envelope tagged with `version`.
 *
 * @param data    The value to wrap
 * @param version Semver string (e.g. "1.0.0")
 */
export function wrapVersioned<T>(data: T, version: string): VersionedData<T> {
  return { $schema: version, data };
}

/**
 * Unwrap a {@link VersionedData} envelope, returning `{ version, data }`.
 * Returns `null` when `raw` is not a valid versioned envelope.
 *
 * @param raw  The raw value to unwrap (typically parsed JSON)
 */
export function unwrapVersioned<T>(raw: unknown): { version: string; data: T } | null {
  if (!isVersioned(raw)) return null;
  return {
    version: (raw as VersionedData<T>).$schema,
    data: (raw as VersionedData<T>).data,
  };
}
