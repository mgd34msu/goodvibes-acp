# ISS-108 — `session/load` history replay not implemented — MUST-level spec requirement

**Severity**: Critical  
**File**: `src/extensions/acp/session-adapter.ts`  
**Lines**: 93-100  
**KB Reference**: KB-03 (Session Load Behavior)  
**Iteration**: 3

## Description

History replay during `session/load` is marked as TODO (ISS-056). The ACP spec uses MUST language: the agent MUST replay the entire conversation history as `session/update` notifications (`user_message_chunk`, `agent_message_chunk`) before sending the `session/load` response. Without this, clients resuming a session see an empty conversation.

## Source Evidence

```typescript
// src/extensions/acp/session-adapter.ts:93-100
// TODO(ISS-056): Implement session history replay on session/load.
// When handling a `session/load` request, the adapter MUST:
//   1. Retrieve stored conversation history via sessions.get(sessionId)
//   2. Iterate through each HistoryMessage in context.history
//   3. Emit session/update notifications: user messages as `user_message_chunk`,
//      agent messages as `agent_message_chunk`, tool interactions as `tool_call`/`tool_call_update`
//   4. Only send the session/load response (result: null) after all history is replayed
// Requires hooking into the transport layer to intercept session/load before the response is sent.
```

## Spec Evidence

KB-03 line 106:
> The Agent MUST replay the entire conversation history as `session/update` notifications before responding to the `session/load` request.

### Verdict: CONFIRMED

The feature is completely unimplemented with a clear TODO comment. This is a MUST-level spec requirement, meaning the agent is non-compliant for session resumption.

## Remediation

1. Implement history replay in the `loadSession` handler
2. Retrieve stored conversation history via `sessions.get(sessionId)`
3. Iterate through each `HistoryMessage` in `context.history`
4. Emit `session/update` notifications for each message:
   - User messages as `user_message_chunk` updates
   - Agent messages as `agent_message_chunk` updates
   - Tool interactions as `tool_call`/`tool_call_update` updates
5. Hook into the transport layer to delay the `session/load` response until all history updates are sent
6. Only then return the `session/load` response (`result: null`)
