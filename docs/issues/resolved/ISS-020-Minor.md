# ISS-020 — Internal _meta keys lack _goodvibes/ namespace prefixing

**Severity**: Minor
**File**: src/extensions/hooks/registrar.ts
**KB Topic**: KB-08: Extensibility

## Original Issue
KB-08 states that within `_meta`, implementations should use namespaced keys. The code uses unprefixed keys: `_validationError`, `_abort`, `_permissionDenied`, `_permissionReason`, `_permissionChecked`, `_permissionGateMissing`. These should be prefixed with `_goodvibes/`.

## Verification

### Source Code Check
At lines 70-77, 155-161, and 173-175 of `src/extensions/hooks/registrar.ts`:
```typescript
// Line 76-77:
_meta: { ...existingMeta, _validationError: validation.reason, _abort: true }

// Lines 155-158:
_meta: { ...existingMeta, _permissionDenied: true, _permissionReason: permResult.reason }

// Line 161:
_meta: { ...existingMeta, _permissionChecked: true }

// Line 173:
_meta: { ...existingMeta, _permissionChecked: false, _permissionGateMissing: true }
```

All six keys (`_validationError`, `_abort`, `_permissionDenied`, `_permissionReason`, `_permissionChecked`, `_permissionGateMissing`) use bare underscore-prefixed names without a namespace.

### ACP Spec Check
KB-08 (Extensibility) states:
- "Within `_meta`, use namespaced keys to avoid collisions"
- Recommended formats: `"vendor.com/key"` or `"_namespace/key"`
- The GoodVibes project's designated namespace is `_goodvibes/` (KB-08 lines 187, 214-219)

The current keys could collide with other implementations using the same bare names.

### Verdict: CONFIRMED
The code violates the KB-08 namespacing convention for `_meta` keys. While these are currently internal-only, if they ever appear on the wire (e.g., forwarded in a session update), they would risk collisions with other ACP implementations. The project has already established the `_goodvibes/` namespace convention.

## Remediation
1. Rename all internal `_meta` keys to use the `_goodvibes/` prefix:
   - `_validationError` -> `_goodvibes/validationError`
   - `_abort` -> `_goodvibes/abort`
   - `_permissionDenied` -> `_goodvibes/permissionDenied`
   - `_permissionReason` -> `_goodvibes/permissionReason`
   - `_permissionChecked` -> `_goodvibes/permissionChecked`
   - `_permissionGateMissing` -> `_goodvibes/permissionGateMissing`
2. Update all consumers of these keys to use the new prefixed names.
