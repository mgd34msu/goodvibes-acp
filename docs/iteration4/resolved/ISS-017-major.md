# ISS-017: SessionConfigOption missing `_meta` field

**Severity**: Major  
**File**: `src/types/config.ts`  
**Lines**: 103-123  
**KB Reference**: KB-08 (Extensibility)

## Description

The SDK includes `_meta?: { [key: string]: unknown } | null` on `SessionConfigOption` but our type omits it.

## Evidence

The SDK `SessionConfigOption` type includes:
```typescript
_meta?: { [key: string]: unknown } | null;
```

Our `SessionConfigOption` type (`src/types/config.ts` lines 103-123) has no `_meta` field.

The SDK also includes `_meta` on `SessionConfigSelectOption` and `SessionConfigSelectGroup`, which our types also lack.

### Verdict: CONFIRMED

The `_meta` field is defined in the SDK on `SessionConfigOption` and related types. Its absence prevents extensibility metadata on config options as required by KB-08.

## Remediation

1. Add `_meta?: Record<string, unknown>` to `SessionConfigOption`.
2. Also add `_meta` to `SessionConfigOptionChoice` (if a separate type) for full SDK alignment.
