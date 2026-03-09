# ISS-048: `_meta` on commands contains non-namespaced keys

**Severity**: Minor  
**File**: `src/extensions/acp/commands-emitter.ts`  
**Lines**: 48-79  
**KB Reference**: KB-01, KB-08 (Extensibility)

## Description

The `GOODVIBES_COMMANDS` array uses `_meta: { category: 'info' }` without a vendor namespace prefix. Per KB-08, custom keys within `_meta` should use namespaced keys (e.g., `"vendor.com/key"` or `"_namespace/key"`) to avoid collision with future ACP spec additions.

## Source Evidence

`src/extensions/acp/commands-emitter.ts` lines 48-79:
```typescript
_meta: { category: 'info' },
_meta: { category: 'config' },
_meta: { category: 'quality' },
_meta: { category: 'control' },
```

## KB-08 Requirement

> Within `_meta`, use namespaced keys to avoid collisions:
> `"vendor.com/key"` -- domain-namespaced (recommended)
> `"_namespace/key"` -- underscore-prefixed namespace

### Verdict: CONFIRMED

The `category` key is not namespaced and could conflict with future ACP spec additions to `_meta`.

## Remediation

Namespace the key under the GoodVibes vendor prefix:
```typescript
_meta: { '_goodvibes/category': 'info' },
```

Apply to all 6 command entries in the array.
