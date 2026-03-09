# ISS-079 — Stale `_meta` doc comment references un-namespaced keys
**Severity**: Nitpick
**File**: `src/extensions/hooks/built-ins.ts`
**KB Topic**: KB-08: Extensibility

## Original Issue
JSDoc references `_validationError`, `_permissionChecked`, `_abort` but code correctly uses `_goodvibes/` prefix.

## Verification

### Source Code Check
`src/extensions/hooks/built-ins.ts` lines 23-25:
```
   * Internal metadata such as `_validationError`, `_permissionChecked`, and `_abort`
   * should be stored here rather than at the root of the context object.
```
Actual usage in `src/extensions/hooks/registrar.ts` uses namespaced keys:
- `'_goodvibes/validationError'`
- `'_goodvibes/abort'`

The JSDoc references the old un-namespaced names that no longer exist in code.

### ACP Spec Check
KB-08 recommends namespacing `_meta` keys to avoid collisions (e.g., `"zed.dev/debugMode"`). The code correctly uses the `_goodvibes/` namespace prefix, but the documentation is stale.

### Verdict: CONFIRMED
The JSDoc comment references un-namespaced key names (`_validationError`, `_permissionChecked`, `_abort`) that don't match the actual namespaced keys used in code (`_goodvibes/validationError`, `_goodvibes/abort`). This is a documentation staleness issue.

## Remediation
1. Update the JSDoc to reference the actual namespaced keys: `_goodvibes/validationError`, `_goodvibes/permissionChecked`, `_goodvibes/abort`.
