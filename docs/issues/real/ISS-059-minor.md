# ISS-059: `SessionConfigOption.category` not typed to ACP standard categories

**Severity**: Minor
**Category**: KB-03 Config Options
**File**: `src/types/config.ts`
**Lines**: 109

## Description

The `category` field is typed as plain `string` instead of the ACP SDK's `SessionConfigOptionCategory` type.

### Verdict: CONFIRMED

Source at `src/types/config.ts` line 109:
```typescript
category: string;
```
The ACP SDK defines (types.gen.d.ts line 2166):
```typescript
type SessionConfigOptionCategory = "mode" | "model" | "thought_level" | string;
```
While both resolve to `string` at runtime, using the SDK type provides better documentation, IDE support, and autocomplete for the three standard categories (`mode`, `model`, `thought_level`). It also communicates that custom categories should use `_` prefix per the SDK comment.

## Remediation

1. Define a local `SessionConfigOptionCategory` type matching the SDK: `'mode' | 'model' | 'thought_level' | (string & {})`.
2. Apply it to the `category` field in `SessionConfigOption`.
3. The `(string & {})` pattern preserves autocomplete for known values while allowing custom strings.

## ACP Reference

KB-03: `SessionConfigOptionCategory` defines standard categories with custom extension via `_` prefix.
