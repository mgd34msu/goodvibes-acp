# ISS-101 — `setConfigOption` returns wrong `type` value for `SessionConfigOption`

**Severity**: Critical  
**File**: `src/extensions/sessions/manager.ts`  
**Line**: 302  
**KB Reference**: KB-03 (Config Options System), KB-01 (Session Config Options)  
**Iteration**: 3

## Description

The `setConfigOption` method builds its return value with `type: 'text' as const`. The issue claims only `"select"` is a valid value, but KB-01 (line 301) defines the type as `'select' | 'text' | 'boolean'`. All three values are spec-valid.

However, the implementation hardcodes `'text'` regardless of the actual option's type. If the config option is a `select` or `boolean` type, returning `'text'` produces an incorrect response.

## Source Evidence

```typescript
// src/extensions/sessions/manager.ts:302
type: 'text' as const,
```

The surrounding code shows this is used generically for all config options returned by `setConfigOption`, not conditionally based on the option's actual type.

## Spec Evidence

KB-01 defines `SessionConfigOption.type` as:
```typescript
type: 'select' | 'text' | 'boolean';
```

The returned type should match the option's declared type, not be hardcoded.

### Verdict: PARTIAL

The claim that only `"select"` is valid is incorrect — KB-01 allows `'select' | 'text' | 'boolean'`. However, the code does hardcode `'text'` for all options regardless of their actual type, which is a real bug when the option is `select` or `boolean`.

## Remediation

1. Store the option's original `type` when registering config options
2. Return the stored type in the `setConfigOption` response instead of hardcoding `'text'`
3. Example fix: replace `type: 'text' as const` with `type: existingOption.type` where `existingOption` is looked up from the registered config options
