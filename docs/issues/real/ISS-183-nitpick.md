# ISS-183 — META Version Key Is Un-Namespaced (`"version"` Not `"_goodvibes/version"`)

**Severity**: Nitpick
**File**: `src/extensions/acp/extensions.ts:20`
**KB Topic**: Extensibility

## Original Issue
`[src/extensions/acp/extensions.ts:20]` META version key is un-namespaced (`"version"` not `"_goodvibes/version"`). Rename to `_goodvibes/version` for namespace consistency. *(Extensibility)*

## Verification

### Source Code Check
Lines 16–20 of `src/extensions/acp/extensions.ts`:
```typescript
/** Shared version for all _meta fields */
const META_VERSION = '0.1.0';

/** Standard _meta appended to all responses */
const META = { version: META_VERSION } as const;
```
The `META` object uses the key `version` (un-namespaced). This object is used as the `_meta` payload attached to ACP responses from `GoodVibesExtensions`.

### ACP Spec Check
From KB 08 — Extensibility:
> Within `_meta`, use namespaced keys to avoid collisions:
> ```
> "vendor.com/key"  — domain-namespaced (recommended)
> "_namespace/key" — underscore-prefixed namespace
> ```

Further:
> All GoodVibes-specific extensions use the `_goodvibes/` prefix for methods and `"_goodvibes/"` namespace prefix for `_meta` keys.

The key `version` is a plain, un-namespaced string. The ACP spec explicitly requires custom `_meta` keys to be namespaced. A future version of the ACP spec could add a top-level `version` key to `_meta` for protocol versioning, causing a collision.

### Verdict: CONFIRMED
The code uses `version` as an un-namespaced `_meta` key, violating the ACP extensibility naming convention. Per the spec, all GoodVibes custom `_meta` keys MUST use the `_goodvibes/` prefix.

## Remediation
1. In `src/extensions/acp/extensions.ts`, rename the META constant:
```typescript
// Before:
const META = { version: META_VERSION } as const;

// After:
const META = { '_goodvibes/version': META_VERSION } as const;
```
2. Verify all places that spread or reference `META` still compile (TypeScript indexed access will work with the string literal key).
