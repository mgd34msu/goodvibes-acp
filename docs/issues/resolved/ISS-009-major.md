# ISS-009 — `SessionConfigOption.currentValue` typed as `string` but spec requires `string | boolean`

**Severity**: Major
**File**: `src/types/config.ts`
**KB Topic**: KB-01: Session Config Options

## Original Issue
`SessionConfigOption.currentValue` is typed as `string` but the ACP spec defines it as `string | boolean`. Boolean-type config options (e.g., `type: 'boolean'`) cannot represent their current value correctly.

## Verification

### Source Code Check
Line 105 of `src/types/config.ts`:
```typescript
/** Current value */
currentValue: string;
```

The type is `string` only.

The same file at line 89 defines `SessionConfigOptionType = 'select' | 'boolean' | 'text'`, so the codebase does support `boolean` as a config option type. However, a boolean-typed option would need to store `true`/`false` as its `currentValue`, which the `string` type cannot represent correctly.

### ACP Spec Check
KB-01 line 302 defines `currentValue: string | boolean` in the `ConfigOption` interface.

KB-03 line 266 defines `currentValue: string` (no boolean).

The KB sources disagree. KB-01 (overview) includes `boolean`; KB-03 (detailed sessions) does not.

However, KB-01 also includes `type: 'select' | 'text' | 'boolean'` (line 301), which logically implies `currentValue` should support boolean values when `type` is `'boolean'`.

### Verdict: PARTIAL
The issue has merit but is overstated. KB-01 supports `currentValue: string | boolean`, but KB-03 (the authoritative config options section) defines it as `string` only. The code matches KB-03. However, since the codebase already supports `type: 'boolean'` in `SessionConfigOptionType`, it is logically inconsistent to restrict `currentValue` to `string` only. The issue is valid from an internal consistency perspective even if KB-03 supports the current type.

## Remediation
1. If the codebase intends to support `type: 'boolean'` config options, change `currentValue: string` to `currentValue: string | boolean` at line 105.
2. Alternatively, if KB-03 is the authoritative source and only `"select"` is valid, remove `'boolean'` and `'text'` from `SessionConfigOptionType` and keep `currentValue: string`.
3. Reconcile KB-01 and KB-03 to establish the canonical type definition.
