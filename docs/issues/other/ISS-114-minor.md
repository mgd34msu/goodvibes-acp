# ISS-114 — Silent catch() Swallows Emission Errors in MCP Tool-Call Bridge

**Severity**: Minor
**File**: src/extensions/mcp/tool-call-bridge.ts:85,101,117
**KB Topic**: Tools & MCP

## Original Issue

**[src/extensions/mcp/tool-call-bridge.ts:85,101,117]** `.catch(() => {})` silently swallows emission errors throughout. *(Tools & MCP)*

## Verification

### Source Code Check

Three identical patterns in `tool-call-bridge.ts`:

```typescript
// Line 85
emitter
  .emitToolCall(sessionId, toolCallId, event.toolName, title, 'in_progress', ...)
  .catch(() => {});

// Line 101
emitter
  .emitToolCallUpdate(sessionId, toolCallId, 'completed', ...)
  .catch(() => {});

// Line 117
emitter
  .emitToolCallUpdate(sessionId, toolCallId, 'failed', ...)
  .catch(() => {});
```

All three `.catch(() => {})` handlers completely swallow emission errors with no logging, no retry, and no fallback. If `sessionUpdate()` fails (e.g., broken ACP connection, session not found, network error), the failure is invisible.

### ACP Spec Check

ACP does not define error handling policies for agent-side `session/update` emissions. The spec defines the wire format and semantics but does not mandate what an agent must do when a notification fails to send. Silent swallowing of emission errors is not an ACP protocol violation.

### Verdict: NOT_ACP_ISSUE

The issue is real and is a code quality concern — silent error swallowing makes debugging tool call visibility failures impossible. However, it is not an ACP compliance issue. The ACP spec does not require error handling for `session/update` notifications, only that they be sent in the correct format when sent.

This is correctly labeled as Minor for code quality.

## Remediation

N/A — not an ACP compliance issue.

For general code quality: replace the silent catches with conditional logging:
```typescript
.catch((err) => {
  // Don't rethrow — emission failure must not abort tool execution
  // But log for observability
  console.error('[McpToolCallBridge] Failed to emit tool_call update:', err);
});
```
