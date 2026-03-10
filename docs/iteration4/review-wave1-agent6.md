# Wave 1 Review — Agent 6: MCP Bridge

**Scope**: `src/extensions/mcp/bridge.ts`, `src/extensions/mcp/transport.ts`, `src/extensions/mcp/tool-call-bridge.ts`, `src/extensions/mcp/index.ts`  
**KB References**: `06-tools-mcp.md`, `04-prompt-turn.md`, `09-sdk-types.md`  
**Reviewer**: ACP Compliance Agent 6  
**Date**: 2026-03-08

---

## Issues

### Issue 1 — stderr pipe pollutes ACP ndjson transport
**File**: `src/extensions/mcp/transport.ts:267`  
**KB Topic**: 06-tools-mcp.md (MCP Transport), ACP ndjson transport protocol  
**Severity**: Critical  

`child.stderr?.pipe(process.stderr)` forwards MCP server stderr directly to the agent's stderr stream. When the ACP agent itself uses stdin/stdout for ndjson transport, stderr may be shared or redirected by the parent process. MCP servers can emit noisy debug output on stderr which will intermingle with agent diagnostic output. While stderr is not the ACP transport channel (stdin/stdout is), certain client implementations may capture stderr for error display, causing MCP server noise to surface as agent errors. The pipe should be consumed and routed through the EventBus or a structured logger, not directly piped to `process.stderr`.

---

### Issue 2 — Missing `mcpCapabilities` declaration in agent initialize response
**File**: `src/extensions/mcp/bridge.ts:224-236` (noted as limitation)  
**KB Topic**: 06-tools-mcp.md lines 422-450 — Agent declares MCP transport support in `agentCapabilities.mcp`  
**Severity**: Critical  

Per KB: the agent MUST declare `agentCapabilities.mcp: { http: boolean, sse: boolean }` during `initialize` so the client knows which MCP transports are supported. The SDK confirms `McpCapabilities = { http?: boolean; sse?: boolean }` exists on `AgentCapabilities.mcpCapabilities`. The code only has a comment acknowledging this gap (lines 231-236) but never actually declares it. Without this, clients cannot know that HTTP/SSE servers will be silently ignored.

---

### Issue 3 — Permission gate is a TODO placeholder
**File**: `src/extensions/mcp/tool-call-bridge.ts:101-108`  
**KB Topic**: 06-tools-mcp.md lines 497-515 — Permission gate between pending and running  
**Severity**: Major  

The KB reference implementation shows a mandatory permission gate pattern: after announcing `pending`, the agent should call `requestPermission()` for tools that require it (file writes, shell commands). The code has only a TODO comment referencing ISS-024/ISS-018. Without this gate, all MCP tool calls bypass user approval, which is a protocol compliance gap for tools with side effects.

---

### Issue 4 — Empty content blocks forwarded on tool completion
**File**: `src/extensions/mcp/tool-call-bridge.ts:131-133`  
**KB Topic**: 06-tools-mcp.md line 532 — `content: mcpResult.content` should forward MCP content directly  
**Severity**: Major  

When `event.result` is non-null but `event.result.data` is `undefined`, the code produces `JSON.stringify('')` which yields `""` — a content block with an empty string. The KB states MCP `ContentBlock[]` should be forwarded directly to ACP without transformation. Instead, the bridge manually wraps data into `{ type: 'content', content: { type: 'text', text: ... } }`, losing any non-text content blocks (images, resources) from MCP tool results. Additionally, when `event.result` is null, an empty array `[]` is sent, which may cause issues if clients expect at least one content block on `completed` status.

---

### Issue 5 — MCP content blocks not forwarded directly to ACP
**File**: `src/extensions/mcp/tool-call-bridge.ts:131-133`, `src/extensions/mcp/tool-proxy.ts:94-111`  
**KB Topic**: 06-tools-mcp.md lines 525-532, 540 — "MCP ContentBlock[] is directly compatible with ACP"  
**Severity**: Major  

The KB explicitly states: "ACP uses the same ContentBlock schema as MCP. MCP tool output can be forwarded to ACP content without transformation." However, `McpToolProxy.execute()` wraps the entire MCP `McpCallResult` into a `ToolResult<T>` envelope, and `McpToolCallBridge` then extracts `.data` and re-wraps it as a text string. The original MCP `content[]` array (which may contain `image`, `resource`, or `embedded_resource` blocks) is lost in this double-wrapping. The bridge should forward `mcpResult.content` directly as ACP `ToolCallContent[]`.

---

### Issue 6 — JSON parse errors silently consumed with only debug logging
**File**: `src/extensions/mcp/transport.ts:99-103`  
**KB Topic**: 06-tools-mcp.md — MCP protocol reliability  
**Severity**: Minor  

Non-JSON lines from MCP server stdout are caught and logged at `console.debug` level only. While the comment notes this is intentional (ISS-075), persistent parse failures could indicate a malfunctioning MCP server. The transport should count consecutive parse failures and emit an `mcp:error` event after a threshold, so the session layer can notify the client.

---

### Issue 7 — No MCP notification handling (notifications from server are dropped)
**File**: `src/extensions/mcp/transport.ts:83-104`  
**KB Topic**: 06-tools-mcp.md lines 456-468 — MCP capabilities negotiation  
**Severity**: Minor  

The `McpClient` line handler only processes messages with a numeric `id` (responses). MCP servers can send JSON-RPC notifications (no `id` field) such as `notifications/tools/list_changed` when tools are dynamically added/removed. These are silently ignored. While not strictly required for basic operation, dropping `list_changed` notifications means the agent's tool list can become stale without any indication.

---

### Issue 8 — `_request` timeout does not clean up pending entry on stdin write failure
**File**: `src/extensions/mcp/transport.ts:204-210`  
**KB Topic**: MCP protocol robustness  
**Severity**: Minor  

If `this._process.stdin.write()` throws or the write callback errors, the pending entry at line 200 remains in the `_pending` map with its timeout still active. The timeout will eventually fire and reject, but the entry leaks until then. The write error path at line 206 calls `reject()` but doesn't delete from `_pending` or clear the timeout, leading to a double-reject (once from the early return, once from the timeout).

---

### Issue 9 — `disconnect()` does not await subprocess exit
**File**: `src/extensions/mcp/bridge.ts:91-97`  
**KB Topic**: 06-tools-mcp.md — MCP server lifecycle  
**Severity**: Minor  

`disconnect()` calls `conn.client.close()` which calls `this._process.kill()`, but the method is `async` and returns immediately without waiting for the process to actually exit. During `disconnectAll()` at session teardown, this means MCP server processes may still be running when the agent reports session shutdown complete. Should await the process exit event or at minimum fire-and-forget with a timeout guard.

---

### Issue 10 — `tool-proxy.ts` `_parseToolName` only splits on first `__` separator
**File**: `src/extensions/mcp/tool-proxy.ts:128-136`  
**KB Topic**: 06-tools-mcp.md — Tool namespacing  
**Severity**: Nitpick  

The parser splits on the first `__` occurrence, so `filesystem__read_file` yields `serverId=filesystem`, `rawToolName=read_file`. This works correctly. However, if a server ID itself contains `__` (unlikely but possible), the split would be incorrect. The `bridge.ts` `_adaptTools` method at line 247 uses the same `__` separator for namespacing. This is consistent but fragile — a validation check during tool registration that server names don't contain `__` would prevent subtle routing bugs.

---

## Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | Critical | transport.ts:267 | stderr pipe pollutes agent output |
| 2 | Critical | bridge.ts:224-236 | Missing mcpCapabilities declaration |
| 3 | Major | tool-call-bridge.ts:101-108 | Permission gate is TODO |
| 4 | Major | tool-call-bridge.ts:131-133 | Empty/lossy content blocks on completion |
| 5 | Major | tool-call-bridge.ts + tool-proxy.ts | MCP content not forwarded directly |
| 6 | Minor | transport.ts:99-103 | JSON parse errors only debug-logged |
| 7 | Minor | transport.ts:83-104 | MCP server notifications dropped |
| 8 | Minor | transport.ts:204-210 | Pending entry leak on stdin write failure |
| 9 | Minor | bridge.ts:91-97 | disconnect() doesn't await process exit |
| 10 | Nitpick | tool-proxy.ts:128-136 | No validation of `__` in server names |

**Critical**: 2 | **Major**: 3 | **Minor**: 4 | **Nitpick**: 1

---

## Overall Score: 5.5 / 10

**Rationale**: The MCP bridge architecture is well-structured with clean separation (bridge orchestrator, transport client, tool proxy, ACP visibility bridge). Code quality is solid with good documentation and error handling patterns. However, two critical protocol compliance gaps (missing `mcpCapabilities` declaration, stderr pipe pollution) and three major issues (no permission gate, lossy content forwarding, empty content blocks) significantly reduce ACP compliance. The implementation works for the happy path of stdio-only MCP servers with text-only tool output, but deviates from the ACP protocol specification for content forwarding, capability declaration, and permission gating.
