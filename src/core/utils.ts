/**
 * utils.ts — Shared utility functions for L1 Core
 *
 * L1 Core — imports only from L0 types and Bun/Node std lib.
 * Zero external npm dependencies.
 */

/**
 * Deep merge two objects. Arrays are replaced, not merged.
 * Returns a new object without mutating inputs.
 *
 * @param target - Base object
 * @param source - Object whose values override target
 * @returns New merged object of type T
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T> | Record<string, unknown>
): T {
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = (source as Record<string, unknown>)[key];
    const tgtVal = target[key as keyof T];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>
      );
    } else if (srcVal !== undefined) {
      result[key] = srcVal;
    }
  }
  return result as T;
}
