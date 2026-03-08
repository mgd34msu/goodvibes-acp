# ISS-109 — `SessionConfigOption.currentValue` typed as `string` but spec requires `string | boolean`

**Severity**: Major  
**File**: `src/types/config.ts`  
**Line**: 105  
**KB Reference**: KB-01 (Session Config Options)  
**Iteration**: 3

## Description

`SessionConfigOption.currentValue` is typed as `string` but the ACP spec defines it as `string | boolean`. Boolean-type config options (e.g., `type: 'boolean'`) cannot represent their current value correctly.

## Source Evidence

```typescript
// src/types/config.ts:105
currentValue: string;
```

Surrounding context shows the field is preceded by `type: SessionConfigOptionType` which includes `'boolean'`, confirming that boolean config options are supported but their values cannot be correctly typed.

## Spec Evidence

KB-01 line 302:
```typescript
currentValue: string | boolean;
```

### Verdict: CONFIRMED

The type is definitively wrong. KB-01 clearly specifies `string | boolean` and the code uses only `string`. This prevents boolean config options from being correctly typed.

## Remediation

1. Change line 105 in `src/types/config.ts` from `currentValue: string;` to `currentValue: string | boolean;`
2. Check all callers of this type for any code that assumes `currentValue` is always a string
3. Update any serialization/deserialization logic that may need to handle boolean values
