# ISS-063 — `AcpSessionUpdateType` Naming Implies Wrong Discriminator Field

**Severity**: Minor
**File**: src/types/events.ts:259-268
**KB Topic**: Session Update discriminator field (09-typescript-sdk lines 123, 792-803)

## Original Issue
The `AcpSessionUpdateType` names suggest the discriminator field is `type`, but the ACP SDK uses `sessionUpdate` as the discriminator.

## Verification

### Source Code Check
Lines 259-268 of `src/types/events.ts` define:
```typescript
export type AcpSessionUpdateType =
  | 'agent_message_chunk'
  | 'tool_call'
  | 'tool_call_update'
  | 'plan'
  | 'agent_thought_chunk'
  | 'session_info'
  | 'available_commands'
  | 'current_mode'
  | 'config_options_update';
```

This is a union of string literal types representing valid discriminator values. The type name ends in `Type` which is a common TypeScript convention for string unions.

### ACP Spec Check
KB-04 (line 301) and KB-09 confirm the ACP SDK uses `sessionUpdate` as the discriminator field name:
```json
{ "sessionUpdate": "session_info", "content": { ... } }
```

The actual discriminator field is `sessionUpdate`, not `type`. However, the code type `AcpSessionUpdateType` is just a union of valid values for that field — it does not define a field name.

### Verdict: PARTIAL
The naming `AcpSessionUpdateType` is a standard TypeScript convention for a string union type and does not inherently imply the discriminator field is `type`. However, there is a minor naming clarity concern: a name like `AcpSessionUpdateKind` or `AcpSessionUpdateDiscriminator` would be less ambiguous. The actual values listed are correct ACP discriminators. The real risk is that consumers might assume this maps to a `type` field rather than a `sessionUpdate` field.

## Remediation
1. Consider renaming to `AcpSessionUpdateKind` or adding a JSDoc comment clarifying this represents values for the `sessionUpdate` discriminator field
2. Low priority — the current naming follows TypeScript conventions and the values are correct
