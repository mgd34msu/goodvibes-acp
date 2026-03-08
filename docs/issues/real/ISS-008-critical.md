# ISS-008 — `session/load` history replay not implemented — MUST-level spec requirement

**Severity**: Critical
**File**: `src/extensions/acp/session-adapter.ts`
**KB Topic**: KB-03: Session Load Behavior

## Original Issue
History replay during `session/load` is marked as TODO (ISS-056). The ACP spec uses MUST language: the agent MUST replay the entire conversation history as `session/update` notifications (`user_message_chunk`, `agent_message_chunk`) before sending the `session/load` response. Without this, clients resuming a session will see an empty conversation.

## Verification

### Source Code Check
Lines 93-100 of `src/extensions/acp/session-adapter.ts`:
```typescript
// TODO(ISS-056): Implement session history replay on session/load.
// When handling a `session/load` request, the adapter MUST:
//   1. Retrieve stored conversation history via sessions.get(sessionId)
//   2. Iterate through each HistoryMessage in context.history
//   3. Emit session/update notifications: user messages as `user_message_chunk`,
//      agent messages as `agent_message_chunk`, tool interactions as `tool_call`/`tool_call_update`
//   4. Only send the session/load response (result: null) after all history is replayed
// Requires hooking into the transport layer to intercept session/load before the response is sent.
```

The feature is entirely unimplemented — only a TODO comment exists.

### ACP Spec Check
KB-03 line 106: "The Agent MUST replay the entire conversation history as `session/update` notifications before responding to the `session/load` request."

KB-03 lines 108-143 show the expected wire format for history replay with `user_message_chunk` and `agent_message_chunk` updates.

KB-03 lines 144-151 show the response must be `{ result: null }` and come only after all history is streamed.

### Verdict: CONFIRMED
This is a MUST-level spec requirement that is entirely unimplemented. The agent advertises `loadSession: true` in its capabilities (see `src/extensions/acp/agent.ts` line 216) but does not fulfill the spec requirement for history replay. Clients resuming a session will see an empty conversation.

## Remediation
1. Implement history replay in the `session/load` handler:
   - Retrieve stored conversation history via `sessions.get(sessionId)`
   - Iterate through each `HistoryMessage` in `context.history`
   - Emit `session/update` notifications: user messages as `user_message_chunk`, agent messages as `agent_message_chunk`
   - Send tool interactions as `tool_call`/`tool_call_update` updates
2. Only send the `session/load` response (`result: null`) after all history notifications are sent.
3. Alternatively, if history replay is not yet feasible, set `loadSession: false` in agent capabilities to avoid advertising an incomplete feature.
