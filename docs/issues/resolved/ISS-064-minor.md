# ISS-064 — JSDoc Incorrectly Claims `'boolean'` and `'text'` Are GoodVibes Extensions

**Severity**: Minor
**File**: src/types/config.ts:87-89
**KB Topic**: ConfigOption type field (01-overview.md line 301)

## Original Issue
The JSDoc comment claims `'boolean'` and `'text'` are "GoodVibes extensions serialized as 'select' on the wire" when the ACP spec natively supports all three.

## Verification

### Source Code Check
Lines 87-89 of `src/types/config.ts`:
```typescript
/**
 * Type of the config option control.
 * @remarks ACP wire only supports 'select'. 'boolean' and 'text' are GoodVibes extensions serialized as 'select' on the wire.
 */
export type SessionConfigOptionType = 'select' | 'boolean' | 'text';
```

The JSDoc claims `boolean` and `text` are extensions that must be serialized as `select`.

### ACP Spec Check
KB-01 (line 301) explicitly defines:
```typescript
interface ConfigOption {
  type: 'select' | 'text' | 'boolean';
  // ...
}
```

All three types (`select`, `text`, `boolean`) are first-class ACP spec types. They are NOT GoodVibes extensions.

### Verdict: CONFIRMED
The JSDoc is factually incorrect. The ACP spec natively supports `'select' | 'text' | 'boolean'` as config option types. Claiming `boolean` and `text` are extensions that need wire serialization as `select` is misleading and could cause implementors to add unnecessary conversion logic.

## Remediation
1. Update the JSDoc to:
```typescript
/**
 * Type of the config option control.
 * @remarks All three types are natively supported by the ACP spec.
 */
export type SessionConfigOptionType = 'select' | 'boolean' | 'text';
```
2. Remove any wire-serialization logic that converts `boolean`/`text` to `select` (if it exists)
