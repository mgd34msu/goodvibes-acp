# ISS-060: `category` required but KB-03 says optional

**Severity**: Minor
**Category**: KB-03 Config Options
**File**: `src/types/config.ts`
**Lines**: 109

## Description

The implementation requires `category` as a mandatory field, but the ACP SDK specifies it as optional.

### Verdict: CONFIRMED

Source at `src/types/config.ts` line 109:
```typescript
category: string;
```
The ACP SDK defines (types.gen.d.ts line 2142):
```typescript
category?: SessionConfigOptionCategory | null;
```
The SDK explicitly marks `category` as optional with `?` and allows `null`. The SDK comment states: "It MUST NOT be required for correctness. Clients MUST handle missing or unknown categories gracefully." The internal type making this required could cause issues if config options are created without a meaningful category.

## Remediation

1. Change the `category` field to optional: `category?: SessionConfigOptionCategory | null`.
2. Update code that accesses `category` to handle the `undefined`/`null` case.
3. Existing usages that set `category: 'mode'` or `category: 'model'` are unaffected.

## ACP Reference

KB-03: `SessionConfigOption.category` is optional per the SDK. Making it required is a stricter contract than the protocol defines.
