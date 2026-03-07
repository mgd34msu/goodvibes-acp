# ISS-095: Missing ACP-specific session/update event types

**Severity**: Minor
**File**: src/types/events.ts
**Line(s)**: 32-39
**Topic**: Overview

## Issue Description
Missing ACP-specific session/update event types: `agent_message_chunk`, `tool_call`, `tool_call_update`, `plan`, `agent_thought_chunk`, `session_info`, `available_commands`, `current_mode`, `config_option`. Add `AcpUpdateEventType` union or document why handled outside L0 event types.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 01-overview.md, lines 202-214; agentclientprotocol.com architecture
- **Spec Says**: The `session/update` notification discriminates on `update.type` with values: `agent_message_chunk`, `tool_call`, `tool_call_update`, `plan`, `agent_thought_chunk`, `session_info`, `available_commands`, `current_mode`, `config_option`.
- **Confirmed**: Yes
- **Notes**: These are the ACP wire-level update types. The codebase defines internal event types (`SessionEventType`, `AgentEventType`, `WRFCEventType`) but not the ACP protocol update types.

### Source Code Check
- **Code Exists**: Yes (the file exists but lacks the types)
- **Code Shows**: Lines 32-39 define `SessionEventType` with values like `session:created`, `session:activated`, etc. These are internal runtime events, not ACP wire protocol update types. No `AcpUpdateEventType` or equivalent union exists in the codebase.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add an `AcpUpdateEventType` string literal union type:
   ```typescript
   export type AcpUpdateEventType =
     | 'agent_message_chunk'
     | 'tool_call'
     | 'tool_call_update'
     | 'plan'
     | 'agent_thought_chunk'
     | 'session_info'
     | 'available_commands'
     | 'current_mode'
     | 'config_option';
   ```
2. Alternatively, document that ACP update types are handled by the SDK's own types and the L0 layer intentionally only models internal events.
