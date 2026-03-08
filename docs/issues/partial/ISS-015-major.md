# ISS-015 — AcpSessionUpdateType Contains 'config_options_update' Instead of 'config_option'

**Severity**: Major
**File**: src/types/events.ts:268
**KB Topic**: Session Update Types (01-overview.md line 214; 09-typescript-sdk lines 917-923)

## Original Issue
`AcpSessionUpdateType` includes `'config_options_update'` but the ACP spec uses `'config_option'` (singular). The discriminator field in the SDK is `sessionUpdate`, not `type`.

## Verification

### Source Code Check
At `events.ts:268`:
```typescript
  | 'config_options_update';
```
The union includes `config_options_update`.

### ACP Spec Check
The spec has contradictory references:

- **KB-09** (typescript-sdk.md line 924): Lists `"config_option"` (singular, no `_update` suffix) as the session update value
- **KB-01** (overview.md line 214): Lists `config_option` in the notification types table
- **KB-04** (prompt-turn.md line ~385): The detailed wire format section header says "config_option (config_options_update)" and the actual JSON wire example uses `"sessionUpdate": "config_options_update"` (plural with `_update`)
- **KB-04** TypeScript interface: `sessionUpdate: "config_options_update"`

The spec itself is internally inconsistent. The overview tables and SDK reference use `config_option` (singular), while the detailed wire format examples and TypeScript interfaces use `config_options_update` (plural with suffix).

### Verdict: PARTIAL
The issue has merit — the SDK reference table (KB-09) and overview (KB-01) use `config_option`, but the detailed wire format in KB-04 uses `config_options_update`. The code matches KB-04's wire format but not KB-09's SDK reference. Given the spec inconsistency, neither value is unambiguously "wrong". However, since the SDK TypeScript interface definition is the most authoritative source for type compatibility, and the code must compile against the SDK, this should be resolved by checking the actual `@agentclientprotocol/sdk` package types.

## Remediation
1. Check the actual `@agentclientprotocol/sdk` package type definitions to determine the canonical discriminator value
2. If the SDK uses `config_option`, change the union value accordingly
3. If the SDK uses `config_options_update`, the code is correct and the issue should be closed
4. Consider supporting both values for forward compatibility
