# ISS-035: SessionManager.load() does not replay conversation history

**Severity**: Major
**File**: src/extensions/sessions/manager.ts
**Line(s)**: 104-113
**Topic**: Sessions

## Issue Description
`load()` does not replay conversation history. Spec requires streaming full history as `session/update` notifications before responding to `session/load`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md, lines 104-153
- **Spec Says**: "The Agent MUST replay the entire conversation history as `session/update` notifications before responding to the `session/load` request." History is streamed as `user_message_chunk` and `agent_message_chunk` updates.
- **Confirmed**: Yes — the spec mandates history replay.
- **Notes**: The spec requirement is on the Agent (transport layer), not necessarily the SessionManager (data layer).

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `SessionManager.load()` at lines 104-113 is purely a data retrieval method — it reads stored context and history from the store and returns them. It does NOT emit any session/update notifications. However, `GoodVibesAgent.loadSession()` in `agent.ts` (lines 203-213) DOES iterate over history and emit `user_message_chunk`/`agent_message_chunk` session updates via `this.conn.sessionUpdate()`. The history replay IS implemented at the agent layer.
- **Issue Confirmed**: No — history replay is handled by the agent, not the manager.

## Verdict
NOT_ACP_ISSUE

## Remediation Steps
No ACP remediation needed. The `SessionManager` is a data-access layer; history replay is correctly implemented in `GoodVibesAgent.loadSession()`. The issue description misattributes the responsibility — the spec requirement applies to the agent transport layer, which does fulfill it.
