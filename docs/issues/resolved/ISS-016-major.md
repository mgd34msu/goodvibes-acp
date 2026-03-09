# ISS-016: SessionConfigOption.options is optional but should be required

**Severity**: Major  
**File**: `src/types/config.ts`  
**Lines**: 119-120  
**KB Reference**: KB-03, KB-09 (Config Options)

## Description

The `options` field on `SessionConfigOption` is declared optional (`options?:`) but the SDK requires it as non-optional for `type: 'select'` config options.

## Evidence

Our type (`src/types/config.ts` line 120):
```typescript
options?: SessionConfigOptionChoice[];
```

The SDK `SessionConfigSelect` type:
```typescript
export type SessionConfigSelect = {
  currentValue: SessionConfigValueId;
  options: SessionConfigSelectOptions;  // REQUIRED
};
```

`SessionConfigOption` extends `SessionConfigSelect` which has `options` as required. Since the only supported type is `'select'`, options must always be present.

### Verdict: CONFIRMED

The `options` field is optional in our type but required in the SDK's `SessionConfigSelect`. This allows constructing invalid config options that would fail SDK validation.

## Remediation

1. Change `options?: SessionConfigOptionChoice[]` to `options: SessionConfigOptionChoice[]` (required).
2. Also update the type to support grouped options per SDK: `options: SessionConfigSelectOption[] | SessionConfigSelectGroup[]`.
