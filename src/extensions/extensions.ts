/**
 * @module extensions/extensions
 * @layer L2 — extensions layer
 *
 * Provides utilities for processing ACP extension metadata (_meta keys).
 * The W3C ACP spec reserves keys prefixed with "_" for protocol use.
 * This module exports a guard that validates _meta keys follow expected patterns
 * before they are processed or forwarded.
 */

// ---------------------------------------------------------------------------
// _meta key validation
// ---------------------------------------------------------------------------

/**
 * Pattern for valid _meta keys.
 *
 * Valid forms:
 *   - _meta                       (bare key used as container)
 *   - _goodvibes/version          (namespaced extension key)
 *   - _goodvibes/turn             (namespaced extension key)
 *
 * Keys must start with "_" and may optionally include a "/"-separated path segment.
 * Keys with arbitrary or unknown prefixes are rejected to prevent injection of
 * unrecognised protocol fields.
 */
const META_KEY_PATTERN = /^_[a-z][a-z0-9]*(\/[a-z][a-z0-9_-]*)?(\.[a-z][a-z0-9_-]*)*$/i;

/**
 * Known top-level _meta namespaces accepted by this runtime.
 * Any key whose namespace is not in this list is considered unknown.
 */
const KNOWN_META_NAMESPACES = new Set<string>([
  '_meta',
  '_goodvibes',
]);

/**
 * Guard: returns true if the given key is a valid, known _meta key.
 *
 * @param key - The key to validate (e.g. "_goodvibes/version", "_meta")
 * @returns true if the key is a valid _meta key; false otherwise
 *
 * @example
 * ```typescript
 * isValidMetaKey('_goodvibes/version')  // true
 * isValidMetaKey('_meta')               // true
 * isValidMetaKey('_unknown/foo')        // false
 * isValidMetaKey('regular-key')         // false
 * ```
 */
export function isValidMetaKey(key: string): boolean {
  if (!META_KEY_PATTERN.test(key)) return false;

  // Extract the namespace (everything before the first "/", or the whole key)
  const slashIdx = key.indexOf('/');
  const namespace = slashIdx === -1 ? key : key.slice(0, slashIdx);

  return KNOWN_META_NAMESPACES.has(namespace);
}

/**
 * Guard: returns true if the value is a non-null object that may be a _meta container.
 *
 * @param value - The value to check
 */
export function isMetaObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Filter a record to only include valid _meta keys.
 *
 * Strips any keys that do not pass isValidMetaKey, preventing unknown
 * extension metadata from being forwarded to clients.
 *
 * @param meta - The raw _meta object from an extension response
 * @returns A new object containing only valid _meta keys
 */
export function filterMetaKeys(meta: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (isValidMetaKey(key)) {
      result[key] = value;
    }
  }
  return result;
}
