# ACP Compliance Review: MCP Bridge

**Reviewer**: goodvibes:reviewer (Iteration 3)  
**Scope**: `src/extensions/mcp/` (bridge.ts, index.ts, tool-call-bridge.ts, tool-proxy.ts, transport.ts)  
**KB References**: `06-tools-mcp.md`, `01-overview.md`  
**ACP Spec**: https://agentclientprotocol.com/llms-full.txt (fetched)  
**Score: 6.8/10** | **Issues: 2 critical, 3 major, 4 minor**

---

## Reality Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Files exist | PASS | All 5 source files present |
| Exports used | PASS | All exports re-exported via index.ts barrel |
| Import chain valid | PASS | index.ts is the barrel; bridge/proxy/transport are cross-referenced |
| No placeholders | WARN | ISS-024 TODO for permission gate (tool-call-bridge.ts:101-108) |
| Integration verified | PASS | McpToolCallBridge, McpToolProxy, McpBridge all connected |

---

## Critical Issues

| # | File | Line | KB Topic | Issue |
|---|------|------|----------|-------|
| 1 | `src/extensions/mcp/tool-call-bridge.ts` | 130 | 06-tools-mcp.md L525-540 | Empty content block forwarded on completed tool calls |
| 2 | `src/extensions/mcp/tool-call-bridge.ts` | 109 | 06-tools-mcp.md L114 | Uses `'in_progress'` status instead of ACP spec `'running'` |

### 1. Empty content block on tool completion (Critical)

**File**: `src/extensions/mcp/tool-call-bridge.ts:130`  
**KB Reference**: 06-tools-mcp.md lines 525-540 ("MCP ContentBlock[] is directly compatible with ACP — forward directly, no transform needed")

The completed tool_call_update emits a hardcoded empty content block:
```typescript
[{ type: 'content', content: { type: 'text', text: '' } }]
```

Per KB 06 line 532, the actual MCP result content should be forwarded directly to the ACP client. The current implementation discards all tool output, meaning the ACP client never sees what the tool returned. This breaks the tool call visibility contract — clients cannot display tool results.

**Fix**: Pass the actual MCP tool result content blocks from the `tool_complete` progress event into the `emitToolCallUpdate` call.

### 2. Wrong status enum value for running state (Critical)

**File**: `src/extensions/mcp/tool-call-bridge.ts:109`  
**KB Reference**: 06-tools-mcp.md line 114 (`type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed'`)

The code uses `'in_progress'` as the active execution status. The ACP wire protocol defines `'running'` (KB 06 line 114, line 17). The ISS-055 comment at lines 44-51 acknowledges the SDK uses `'in_progress'`, but the wire-level spec is authoritative for interoperability — a non-SDK ACP client receiving `'in_progress'` would not recognize it as a valid status.

**Fix**: Use `'running'` as the status value, or verify the SDK version actually sends `'running'` over the wire regardless of the TypeScript type name.

---

## Major Issues

| # | File | Line | KB Topic | Issue |
|---|------|------|----------|-------|
| 3 | `src/extensions/mcp/tool-call-bridge.ts` | 91-113 | 06-tools-mcp.md L14-19 | Fire-and-forget tool_call lifecycle breaks on partial failure |
| 4 | `src/extensions/mcp/tool-proxy.ts` | 128-136 | 06-tools-mcp.md L411 | Tool name parse/unparse asymmetry with double-underscore server names |
| 5 | `src/extensions/mcp/transport.ts` | 207 | 01-overview.md L39 | No write error handling on stdin — pending requests hang until timeout |

### 3. Fire-and-forget tool_call lifecycle (Major)

**File**: `src/extensions/mcp/tool-call-bridge.ts:91-113`  
**KB Reference**: 06-tools-mcp.md lines 14-19 (lifecycle: pending -> running -> completed|failed)

The `emitToolCall` and `emitToolCallUpdate` calls are chained with `.then()` and a shared `.catch()`. If the initial `emitToolCall` (pending) fails, the `.then()` block still attempts to emit `'in_progress'`, potentially creating an orphaned update for a tool_call that was never announced. The ACP lifecycle requires `tool_call` (create) before `tool_call_update` — violating this order could confuse clients.

**Fix**: Await both calls sequentially, and skip the `tool_call_update` if `emitToolCall` fails. Consider using `async/await` inside the handler with proper error boundaries.

### 4. Tool name parse/unparse asymmetry (Major)

**File**: `src/extensions/mcp/tool-proxy.ts:128-136`  
**KB Reference**: 06-tools-mcp.md line 411 (name field used for tool namespacing)

`_parseToolName` splits on the first `__` occurrence. Bridge.ts:247 constructs names as `${serverId}__${tool.name}`. If `serverId` (from `server.name`) or `tool.name` contains `__`, the parse is incorrect. For example, server name `my__server` with tool `read` produces `my__server__read`, which parses as serverId=`my`, rawToolName=`server__read` — routing to the wrong server.

**Fix**: Use a separator that cannot appear in MCP server or tool names, or document the constraint that server names must not contain `__`.

### 5. No write error handling on stdin (Major)

**File**: `src/extensions/mcp/transport.ts:207`  
**KB Reference**: 01-overview.md line 39 (ndjson over stdio transport)

`stdin.write()` does not handle the write callback or error event. If the subprocess stdin pipe is broken (process crashed between check and write), the pending promise will hang until the 30-second timeout. This creates unnecessary latency for failure detection.

**Fix**: Pass an error callback to `stdin.write()` and reject the pending promise immediately on write failure.

---

## Minor Issues

| # | File | Line | KB Topic | Issue |
|---|------|------|----------|-------|
| 6 | `src/extensions/mcp/transport.ts` | 99 | 01-overview.md L39 | Empty catch block silently swallows JSON parse errors |
| 7 | `src/extensions/mcp/transport.ts` | 265 | 01-overview.md L39-44 | MCP server stderr piped to agent stderr may pollute ndjson |
| 8 | `src/extensions/mcp/bridge.ts` | 223-241 | 06-tools-mcp.md L422-450 | HTTP/SSE capability not declared in agent initialize |
| 9 | `src/extensions/mcp/tool-call-bridge.ts` | 101-108 | 06-tools-mcp.md L497-514 | Permission gate is a TODO placeholder (ISS-024) |

### 6. Silent JSON parse error swallowing (Minor)

**File**: `src/extensions/mcp/transport.ts:99`

The `catch {}` block silently ignores all parse failures on stdout lines. While non-JSON lines from MCP servers are unusual, repeated parse failures could indicate a misconfigured server or protocol mismatch. At minimum, a debug-level log would aid troubleshooting.

### 7. MCP stderr pipe may pollute agent output (Minor)

**File**: `src/extensions/mcp/transport.ts:265`

`child.stderr?.pipe(process.stderr)` forwards MCP server diagnostic output to the agent's stderr. If any downstream component parses agent stderr (e.g., for structured logging or ndjson), MCP server noise could cause parse errors.

### 8. Missing MCP capability declaration (Minor)

**File**: `src/extensions/mcp/bridge.ts:223-241`  
**KB Reference**: 06-tools-mcp.md lines 422-450

The comment at lines 231-236 acknowledges that `mcp: { http: false, sse: false }` should be declared in `agentCapabilities` during `initialize`, but this is not implemented. Per KB 06, the client uses this to know which MCP transports the agent supports. Without it, clients may send HTTP/SSE server configs that will be silently dropped.

### 9. Permission gate placeholder (Minor)

**File**: `src/extensions/mcp/tool-call-bridge.ts:101-108`  
**KB Reference**: 06-tools-mcp.md lines 497-514 (permission gate between pending and running)

The TODO at ISS-024 describes the permission gate flow but it is not implemented. The KB spec (06, lines 180-196) shows that destructive operations (file writes, shell commands) should request permission between pending and running states. Currently all tools transition directly from pending to in_progress without any permission check.

---

## Category Breakdown

| Category | Score | Key Issues |
|----------|-------|------------|
| Security | 7/10 | Missing permission gate (ISS-024) |
| Error Handling | 5/10 | Fire-and-forget lifecycle, silent catch, no write error handling |
| Testing | N/A | No test files in scope |
| Organization | 9/10 | Clean separation: bridge, proxy, transport, tool-call-bridge |
| Performance | 8/10 | Parallel connections, proper timeouts |
| SOLID/DRY | 8/10 | Good SRP, IToolProvider interface properly implemented |
| Naming | 9/10 | Clear naming, consistent conventions |
| Maintainability | 7/10 | Good docs/comments, but fire-and-forget patterns add complexity |
| Documentation | 9/10 | Thorough JSDoc, module headers, limitation annotations |
| Dependencies | 8/10 | Minimal deps, no @modelcontextprotocol/sdk needed |

---

## Recommendations

1. **Immediate**: Fix empty content forwarding on completed tool calls (Issue 1) — this breaks ACP tool visibility
2. **Immediate**: Resolve `'in_progress'` vs `'running'` status discrepancy (Issue 2) — interoperability risk
3. **This PR**: Convert fire-and-forget `.then()` chains to proper async/await with error boundaries (Issue 3)
4. **This PR**: Add write error callback in transport.ts:207 (Issue 5)
5. **Follow-up**: Implement permission gate (ISS-024) for destructive tool operations
6. **Follow-up**: Declare `mcp: { http: false, sse: false }` in agent capabilities
