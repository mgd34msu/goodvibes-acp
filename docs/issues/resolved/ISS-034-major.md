# ISS-034 — L0 SessionConfigOptionChoice.label contradicts SDK ConfigOptionValue.name

**Severity**: Major
**File**: `src/types/config.ts`
**KB Topic**: KB-10: ACP SDK Types

## Original Issue
The L0 type defines `label?: string` (optional) but the SDK type `SessionConfigSelectOption` uses `name: string` (required). Code using the L0 type to build config options would produce objects missing the required `name` field.

## Verification

### Source Code Check
Lines 76-83 of `config.ts`:
```typescript
export type SessionConfigOptionChoice = {
  /** Machine value */
  value: string;
  /** Human-readable display label (ACP spec: `label?: string`) */
  label?: string;
  /** Optional description */
  description?: string;
};
```
The L0 type uses `label?: string` — optional, with the field name `label`.

### ACP Spec Check
KB-03 (Sessions) defines `ConfigOptionValue` (lines 271-274):
```typescript
interface ConfigOptionValue {
  value: string;    // identifier used when setting
  name: string;     // human-readable label
  description?: string;
}
```
The spec uses `name: string` (required), not `label?: string` (optional). The L0 type's field name and optionality both diverge from the spec.

### Verdict: CONFIRMED
The L0 type uses `label?: string` where the ACP spec requires `name: string`. This is both a naming mismatch and an optionality mismatch. Code building config options from the L0 type will produce objects missing the required `name` field, causing protocol-level errors when sent to clients.

## Remediation
1. Rename `label` to `name` in `SessionConfigOptionChoice`.
2. Make it required: `name: string` (not optional).
3. Update all code that references `.label` to use `.name`.
4. Update the JSDoc comment to reference the correct spec field.
