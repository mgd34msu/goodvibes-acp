# ISS-063 — available_commands discriminator cast through unknown

**Severity**: Minor
**File**: `src/extensions/acp/commands-emitter.ts`
**KB Topic**: KB-04: Session Update Discriminators

## Original Issue
The code casts through `unknown` to emit `sessionUpdate: 'available_commands'` while acknowledging the SDK uses a different discriminator. The double-cast hides potential wire-format errors.

## Verification

### Source Code Check
In `src/extensions/acp/commands-emitter.ts` lines 113-116, the code uses `sessionUpdate: 'available_commands'` and casts through `unknown` to `acp.SessionUpdate`. Comments explain: "the installed SDK types the discriminator as 'available_commands_update' and the field as `availableCommands`; the ACP spec uses 'available_commands' + `commands`."

### ACP Spec Check
The SDK `SessionUpdate` type uses `sessionUpdate: "available_commands_update"` as the discriminator (confirmed in `types.gen.d.ts` line 2525-2526), with `availableCommands` field via `AvailableCommandsUpdate`. The code uses `'available_commands'` instead, which does not match the SDK wire format. Per the task context, SDK is authoritative over KB prose.

### Verdict: CONFIRMED
The code uses `'available_commands'` as the discriminator but the SDK expects `'available_commands_update'`. The `as unknown as` cast masks a real type mismatch. Since the SDK is authoritative, the code should use the SDK's discriminator value.

## Remediation
1. Change the discriminator from `'available_commands'` to `'available_commands_update'`
2. Use `availableCommands` field name to match SDK's `AvailableCommandsUpdate` type
3. Remove the `as unknown as acp.SessionUpdate` cast — the types should align naturally
4. Update the `AcpSessionUpdateType` union in `src/types/events.ts` if needed
