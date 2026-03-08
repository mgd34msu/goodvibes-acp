# ISS-024 — MCP Tool Call Has No Permission Gate Between Pending and Running

**Severity**: Major
**File**: src/extensions/mcp/tool-call-bridge.ts:88-105
**KB Topic**: Permission Gating (06-tools-mcp.md lines 497-514)

## Original Issue
The bridge transitions tool calls directly from `pending` to `in_progress` without any permission check. No `session/request_permission` call is made for any tool.

## Verification

### Source Code Check
The tool_start handler in `tool-call-bridge.ts`:
```typescript
emitter
  .emitToolCall(
    sessionId,
    toolCallId,
    event.toolName,
    title,
    'other',
    { '_goodvibes/turn': event.turn },
  )
  .then(() =>
    emitter.emitToolCallUpdate(sessionId, toolCallId, 'in_progress'),
  )
```
The code emits `pending` (via `emitToolCall`) and immediately chains `.then()` to transition to `in_progress`. There is no permission check between these two states. No call to `session/request_permission` exists anywhere in the bridge.

### ACP Spec Check
KB-06 (06-tools-mcp.md lines 497-514) shows the reference implementation with a permission gate:
```typescript
// 2. Optionally gate on permission
if (requiresPermission(toolName)) {
  const { granted } = await acpConn.requestPermission({
    sessionId,
    permission: {
      type: inferPermissionType(toolName),
      title: `${serverName}: ${toolName}`,
      description: JSON.stringify(toolInput),
    },
  });
  if (!granted) {
    // ... status: 'failed', content: 'Permission denied'
    return null;
  }
}
// 3. Execute via MCP
await acpConn.sessionUpdate({
  sessionId,
  update: { sessionUpdate: 'tool_call_update', toolCallId, status: 'running' },
});
```
The spec shows permission gating should occur between `pending` and `running` states.

### Verdict: CONFIRMED
The code has no permission gate at all. Tool calls transition directly from pending to in_progress without any user approval mechanism. This is directly related to ISS-021 (permission hook stub) and ISS-018 (PermissionGate not wired).

## Remediation
1. Between the `emitToolCall` (pending) and `emitToolCallUpdate` (in_progress), add a permission check
2. Implement `requiresPermission(toolName)` to classify tools (file writes, shell commands, etc.)
3. Call `connection.requestPermission()` with proper `permission` object for tools requiring approval
4. If denied, emit `tool_call_update` with `status: 'failed'` and `content: [{ type: 'text', text: 'Permission denied' }]`
5. Only transition to `in_progress` (running) after permission is granted
