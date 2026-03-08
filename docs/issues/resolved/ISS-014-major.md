# ISS-014 — AcpSessionUpdateType Missing 'finish' Value

**Severity**: Major
**File**: src/types/events.ts:259-268
**KB Topic**: Session Update Types (09-typescript-sdk lines 917-923)

## Original Issue
`AcpSessionUpdateType` is missing the `'finish'` update type. The ACP SDK includes `finish` to signal agent response completion.

## Verification

### Source Code Check
At `events.ts:259-268`:
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
The `'finish'` value is absent from the union.

### ACP Spec Check
KB-09 (typescript-sdk.md line 921) lists `"finish"` as a valid `sessionUpdate` discriminator value with description "Agent done with response".

KB-01 overview also references session update types but does not explicitly list `finish` in its table. However, the SDK reference is authoritative for TypeScript types.

The ACP protocol requires agents to send `finish` updates to signal response completion (referenced also in ISS-004 where shutdown must send `finish` with `stopReason`).

### Verdict: CONFIRMED
The `'finish'` value is clearly defined in the ACP SDK's session update reference and is required for proper session lifecycle management. Without it in the type union, emitting finish updates requires unsafe type casts or `as any`, and TypeScript will reject valid finish payloads at compile time.

## Remediation
1. Add `| 'finish'` to the `AcpSessionUpdateType` union in `src/types/events.ts`
2. Verify that any code emitting finish updates (or that should be) uses this type
