# ISS-020: Agent coordinator/tracker has no ACP session lifecycle integration

**Severity**: Critical
**File**: src/extensions/agents/coordinator.ts + tracker.ts
**Line(s)**: coordinator.ts:1-182, tracker.ts:1-169
**Topic**: TypeScript SDK

## Issue Description
No ACP session lifecycle integration (`initialize` / `newSession` / `prompt`). Uses custom `AgentStatus` values not mapped to ACP session update types.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/09-typescript-sdk.md (Agent interface, session lifecycle) and docs/acp-knowledgebase/03-sessions.md (session updates)
- **Spec Says**: ACP defines session lifecycle through `initialize`, `session/new`, `session/prompt`, `session/cancel` methods. Session state changes are communicated via `session/update` notifications with typed updates (`session_info_update`, `agent_message_chunk`, `tool_call`, `finish`, etc.). The `Agent` interface requires implementing these methods.
- **Confirmed**: Yes
- **Notes**: The coordinator/tracker manages internal sub-agent orchestration, which is not directly defined in ACP. However, if sub-agents interact with ACP clients, their status transitions should be mapped to ACP session update notifications.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `AgentCoordinator` (coordinator.ts) manages spawn/cancel/result with `AgentTracker` tracking status transitions. `AgentTracker` (tracker.ts) uses `AgentStatus` values: `spawned`, `running`, `completed`, `failed`, `cancelled`. Status transitions emit internal EventBus events (`agent:registered`, `agent:status-changed`, `agent:completed`, `agent:failed`) but never produce ACP `session/update` notifications. There is no import of any ACP SDK type, no reference to `AgentSideConnection`, and no `sessionUpdate` calls.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
The agent coordinator and tracker operate entirely within the internal event system with no bridge to ACP session updates. Sub-agent lifecycle events (spawn, progress, completion, failure) are invisible to ACP clients. This means clients have no visibility into multi-agent orchestration happening during a prompt turn.

## Remediation Steps
1. Create an `AgentEventBridge` that subscribes to `agent:status-changed` events and emits corresponding ACP `session/update` notifications (e.g., `tool_call` updates for sub-agent execution)
2. Map `AgentStatus` transitions to appropriate ACP session update types:
   - `spawned` -> `tool_call` with status `pending`
   - `running` -> `tool_call_update` with status `running`
   - `completed` -> `tool_call_update` with status `completed`
   - `failed`/`cancelled` -> `tool_call_update` with status `failed`
3. Include sub-agent task descriptions in the tool call `title` field for client visibility
4. Pass the `AgentSideConnection` or a notification callback to the coordinator for ACP integration
