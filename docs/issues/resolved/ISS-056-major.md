# ISS-056 — Session History Replay Not Implemented on session/load

**Severity**: Major
**File**: src/extensions/acp/session-adapter.ts:52-83
**KB Topic**: Session Persistence and Resumption — Behavior During Load (03-sessions.md lines 104-106)

## Original Issue
There is no adapter logic to stream conversation history as `session/update` notifications (using `user_message_chunk` / `agent_message_chunk`) before responding to `session/load`.

## Verification

### Source Code Check
The `AcpSessionAdapter` (lines 52-83) registers listeners for `session:created`, `session:destroyed`, `session:state-changed`, and `session:mode-changed` events. There is no handler for `session/load` that replays conversation history. The adapter bridges session lifecycle events but does not implement history replay.

### ACP Spec Check
KB-03 (lines 104-106) states:
> "The Agent MUST replay the entire conversation history as `session/update` notifications before responding to the `session/load` request."

The spec further details (lines 187-197) that history replay uses `session/update` notifications with `user_message_chunk` and `agent_message_chunk` update types to stream the full conversation before the `session/load` response is sent.

### Verdict: CONFIRMED
No code exists to replay conversation history on `session/load`. A client loading a previous session would receive no prior context, making session resumption functionally broken.

## Remediation
1. Implement a `session/load` handler that:
   a. Retrieves the stored conversation history for the given `sessionId`
   b. Iterates through each historical message
   c. Emits `session/update` notifications with `user_message_chunk` for user messages
   d. Emits `session/update` notifications with `agent_message_chunk` for agent messages
   e. Replays `tool_call` and `tool_call_update` for tool interactions
   f. Only then sends the `session/load` response (result: `null`)
2. Ensure the replay respects message ordering and includes all content blocks
