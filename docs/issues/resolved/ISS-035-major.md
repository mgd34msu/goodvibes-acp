# ISS-035 — L0 SessionConfigOptionType declares unsupported types boolean and text

**Severity**: Major
**File**: `src/types/config.ts`
**KB Topic**: KB-10: ACP SDK Types

## Original Issue
The L0 type declares `'select' | 'boolean' | 'text'` but the SDK only supports `type: "select"`. The comment stating all three types are natively supported by ACP is factually incorrect.

## Verification

### Source Code Check
Lines 87-89 of `config.ts`:
```typescript
/**
 * Type of the config option control.
 * @remarks All three types are natively supported by the ACP spec (KB-01 line 301).
 */
export type SessionConfigOptionType = 'select' | 'boolean' | 'text';
```
The type declares three values and the JSDoc comment claims all three are supported by the ACP spec.

### ACP Spec Check
KB-03 (Sessions) defines (line 258):
```typescript
type ConfigOptionType = "select"; // only type currently defined
```
The ACP spec explicitly states that only `"select"` is currently defined. The comment in the L0 type referencing "KB-01 line 301" is factually incorrect — the spec does not support `'boolean'` or `'text'` as config option types.

### Verdict: CONFIRMED
The L0 type declares two config option types (`'boolean'` and `'text'`) that do not exist in the ACP spec, and the JSDoc comment incorrectly claims they are natively supported. Sending a config option with `type: 'boolean'` or `type: 'text'` would produce a protocol-incompatible response.

## Remediation
1. Restrict the type to `type SessionConfigOptionType = 'select';` to match the ACP spec.
2. If `'boolean'` and `'text'` are needed as internal extensions, define a separate internal type and document that they must be serialized as `'select'` (with appropriate options) when sent over the ACP wire.
3. Remove or correct the misleading JSDoc comment.
