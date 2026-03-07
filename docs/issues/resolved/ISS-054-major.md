# ISS-054: extNotification only handles _goodvibes/directive, no outbound status/events

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**Line(s)**: 431-440
**Topic**: Extensibility

## Issue Description
`extNotification` only handles `_goodvibes/directive`. No code sends `_goodvibes/status` or `_goodvibes/events` notifications to clients via `conn.extNotification()`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/08-extensibility.md (lines 191-198)
- **Spec Says**: `_goodvibes/status` is a notification (agent -> client) for WRFC phase progress. `_goodvibes/events` is a notification (agent -> client) for event bus notifications. Both should be proactively pushed by the agent, not requested by the client.
- **Confirmed**: Yes
- **Notes**: The KB table explicitly marks both as `notification` type with `agent -> client` direction. The wire format example at lines 125-138 shows a notification with no `id` field.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `agent.ts:451-461` shows `extNotification()` only has an `if (method === '_goodvibes/directive')` handler for inbound client notifications. There is no code anywhere in agent.ts that calls `conn.extNotification('_goodvibes/status', ...)` or `conn.extNotification('_goodvibes/events', ...)` to push notifications to clients.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Subscribe to relevant EventBus events (WRFC phase changes, trigger fires, hook executions)
2. On WRFC phase change, call `conn.extNotification('_goodvibes/status', { sessionId, phase, completedSteps, totalSteps })`
3. On significant event bus activity, call `conn.extNotification('_goodvibes/events', { ... })`
4. Ensure these are fire-and-forget (no response expected per JSON-RPC notification semantics)
