# ISS-140: `deepMerge` skips `undefined` values, preventing key deletion

**Source**: `src/core/utils.ts` line 36
**KB Reference**: KB-08 (Extensibility)
**Severity**: Minor

### Verdict: CONFIRMED

The `deepMerge` function contains the condition `else if (srcVal !== undefined)` which skips assignment when the source value is `undefined`. This means callers cannot use `deepMerge` (and by extension `StateStore.merge()`) to remove keys from nested objects by setting them to `undefined`.

This limits `_meta` field management where removing a key from a nested metadata object is a valid operation. The only way to "delete" a key is to set it to `null`, which leaves the key present with a null value rather than removing it.

### Remediation

1. Document the current behavior clearly: `undefined` values in the source are ignored (keys are preserved from target)
2. Consider adding a sentinel value (e.g., `const DELETE = Symbol('delete')`) that callers can use to explicitly request key deletion
3. Alternatively, add an `options` parameter to `deepMerge` with a `deleteOnUndefined: boolean` flag for callers that need deletion semantics
