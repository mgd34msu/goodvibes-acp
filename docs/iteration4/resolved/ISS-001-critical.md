# ISS-001 — AcpSessionUpdateType discriminator values are wrong
**Severity**: Critical
**File**: `src/types/events.ts`
**KB Topic**: KB-04, KB-09: Session Updates

## Original Issue
The `AcpSessionUpdateType` union contains multiple incorrect discriminator values. Five values have incorrect suffixes (missing `_update`): `available_commands` should be `available_commands_update`, `current_mode` should be `current_mode_update`, `config_option` should be `config_option_update`, `session_info` should be `session_info_update`. Additionally, `user_message_chunk` and `usage_update` are missing, and `finish` is present but not defined in the SDK.

## Verification

### Source Code Check
`src/types/events.ts` lines 263-274 define:
```
export type AcpSessionUpdateType =
  | 'agent_message_chunk'
  | 'tool_call'
  | 'tool_call_update'
  | 'plan'
  | 'agent_thought_chunk'
  | 'session_info'
  | 'available_commands'
  | 'current_mode'
  | 'config_option'
  | 'finish';
```

### ACP Spec Check
SDK `SessionUpdate` (types.gen.d.ts:2512-2534) defines the authoritative discriminator union:
- `user_message_chunk`
- `agent_message_chunk`
- `agent_thought_chunk`
- `tool_call`
- `tool_call_update`
- `plan`
- `available_commands_update`
- `current_mode_update`
- `config_option_update`
- `session_info_update`
- `usage_update`

### Verdict: CONFIRMED
Four discriminators are missing the `_update` suffix (`session_info`, `available_commands`, `current_mode`, `config_option`). Two discriminators are missing entirely (`user_message_chunk`, `usage_update`). One non-spec discriminator is present (`finish`). The code does not match the SDK.

## Remediation
1. Replace the `AcpSessionUpdateType` union with the SDK-authoritative values.
2. Update all consumers that use the old discriminator strings.
3. Remove `finish` from the union — there is no finish session update in the SDK.
4. Add `user_message_chunk` and `usage_update`.
