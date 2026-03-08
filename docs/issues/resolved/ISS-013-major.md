# ISS-013 — ConfigOption.label Field Named 'name' — Wire Format Mismatch

**Severity**: Major
**File**: src/types/config.ts:80
**KB Topic**: ConfigOption schema (01-overview.md lines 297-304)

## Original Issue
`SessionConfigOptionChoice` uses `name` for the human-readable label but the ACP spec uses `label` (optional). Config options serialized to ACP wire format will have the wrong field name.

## Verification

### Source Code Check
At `config.ts:77-83`:
```typescript
export type SessionConfigOptionChoice = {
  /** Machine value */
  value: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
};
```
The field is called `name`, not `label`.

### ACP Spec Check
KB-01 (overview.md line 303) defines the interface as:
```typescript
options?: Array<{ value: string; label?: string }>;
```
The field is `label` (optional), not `name`.

However, KB-04 (prompt-turn.md line ~405) has a JSON example that uses `"name"` instead of `"label"` in the config options example. This represents an inconsistency in the knowledge base itself.

The upstream ACP spec (agentclientprotocol.com) uses `label` in the TypeScript interface definition, making `label` the canonical field name.

### Verdict: PARTIAL
The issue is real — the code uses `name` while the ACP TypeScript interface defines `label`. However, the KB itself contains an example using `name`, suggesting there may be historical ambiguity in the spec. The code should use `label` to match the TypeScript interface, but this is less clear-cut than the issue suggests because even spec examples use `name`.

## Remediation
1. Rename `name` to `label` in `SessionConfigOptionChoice` type definition
2. Make `label` optional (`label?: string`) to match the spec's `label?: string`
3. Update all usages of `SessionConfigOptionChoice.name` throughout the codebase to use `.label`
4. Add a serialization step if needed to ensure wire format uses `label`
