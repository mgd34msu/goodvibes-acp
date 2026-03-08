# ISS-072 — MCP Bridge Only Supports Stdio — HTTP/SSE Silently Skipped Without ACP Notification

**Severity**: Minor
**File**: src/extensions/mcp/bridge.ts:200-231
**KB Topic**: MCP Transport Types (06-tools-mcp.md lines 420-450)

## Original Issue
URL-based MCP servers are logged with `console.error` and silently skipped. No structured error is propagated to the ACP client.

## Verification

### Source Code Check
Lines 223-231 of `src/extensions/mcp/bridge.ts` confirm the issue:

```typescript
// HTTP/SSE: not supported yet — log a warning and skip gracefully.
// NOTE: Agent capability declaration (`mcp: { http: false, sse: false }`) should
// be added to the agent descriptor in src/extensions/acp/agent.ts once that
// field is part of the ACP capability schema.
console.error(`[MCP] Skipping non-stdio server "${server.name}": HTTP/SSE transport not yet supported`);
return null;
```

The code logs to `console.error` and returns `null`. No event is emitted via `eventBus` and no ACP notification is sent to the client.

### ACP Spec Check
KB-06 (06-tools-mcp.md lines 420-433) documents that agents declare transport support via `agentCapabilities.mcp` during `initialize`. The spec shows `mcp.http` and `mcp.sse` fields for declaring HTTP/SSE support. The code's own comments acknowledge this: "Agent capability declaration (`mcp: { http: false, sse: false }`) should be added to the agent descriptor."

When a server cannot be connected, the client has no visibility into the failure — it simply never sees tools from that server.

### Verdict: CONFIRMED
The code silently drops non-stdio MCP servers with only a `console.error` log. The existing `eventBus.emit('mcp:error', ...)` pattern used elsewhere in the same file (line 196) is not applied here, and no ACP-level notification reaches the client. The code's own comments acknowledge the missing capability declaration.

## Remediation
1. Emit an `mcp:error` event via `eventBus` when skipping a non-stdio server, matching the error pattern already used in `_connectServer()` (line 196)
2. Declare `mcp: { http: false, sse: false }` in `agentCapabilities` during `initialize` so the client knows the limitation upfront
3. Consider emitting a `session/update` notification with a descriptive message so the ACP client can display the limitation to the user
