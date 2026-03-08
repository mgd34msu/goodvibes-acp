# ISS-058: `setConfigOption` accepts arbitrary keys without validation

**Severity**: Minor
**Category**: KB-03 Config Options
**File**: `src/extensions/sessions/manager.ts`
**Lines**: 292-322

## Description

The `setConfigOption` method accepts any `key` string without validating against known config option IDs or valid choices.

### Verdict: CONFIRMED

Source at lines 295-296:
```typescript
async setConfigOption(sessionId: string, key: string, value: string): Promise<schema.SessionConfigOption[]> {
```
The method stores `{ [key]: value }` into `configOptions` without checking:
- Whether `key` matches a known `SessionConfigId` (e.g., `mode`, `model`)
- Whether `value` is a valid choice from the option's `options` array
- Whether the option type supports the given value format

The ACP `SetSessionConfigOptionRequest` (types.gen.d.ts line 2538) specifies `configId: SessionConfigId` and `value: SessionConfigValueId`, implying structured identifiers, not arbitrary strings.

## Remediation

1. Validate `key` against the set of known config option IDs (from `buildConfigOptions()`).
2. Validate `value` against the option's available choices.
3. Return an appropriate error (e.g., `RequestError.invalidParams`) for unknown keys or invalid values.

## ACP Reference

KB-03: Config options have structured IDs and valid value sets. Accepting arbitrary keys undermines the config option contract.
