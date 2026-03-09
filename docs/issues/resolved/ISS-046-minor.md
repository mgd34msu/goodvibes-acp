# ISS-046: SessionConfigOption.options doesn't support grouped options

**Severity**: Minor  
**File**: `src/types/config.ts`  
**Lines**: 119-120  
**KB Reference**: KB-09 (Config Options)

## Description

The SDK supports both flat and grouped option lists via `SessionConfigSelectOptions = Array<SessionConfigSelectOption> | Array<SessionConfigSelectGroup>`. Our L0 type only supports flat options via `options?: SessionConfigOptionChoice[]`, preventing visual grouping (e.g., models by provider).

## Source Evidence

`src/types/config.ts` line ~120:
```typescript
options?: SessionConfigOptionChoice[];
```

SDK `types.gen.d.ts` line 2237:
```typescript
export type SessionConfigSelectOptions = Array<SessionConfigSelectOption> | Array<SessionConfigSelectGroup>;
```

The SDK's `SessionConfigSelectGroup` includes a `group` identifier, optional `label`, and nested `options` array.

### Verdict: CONFIRMED

Our type definition does not support the SDK's grouped option format.

## Remediation

1. Define a `SessionConfigOptionGroup` type:
```typescript
export type SessionConfigOptionGroup = {
  group: string;
  label?: string;
  options: SessionConfigOptionChoice[];
};
```

2. Update the `options` field to accept both:
```typescript
options?: SessionConfigOptionChoice[] | SessionConfigOptionGroup[];
```
