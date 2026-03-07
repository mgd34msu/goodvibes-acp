# ISS-175 — `McpToolProxy.execute()` Does Not Emit ACP `tool_call` Notifications

**Severity**: Minor
**File**: src/extensions/mcp/tool-proxy.ts:76-116
**KB Topic**: Tools & MCP

## Original Issue
`execute` method wraps MCP results but does not emit ACP `tool_call`/`tool_call_update` notifications. No integration between `McpToolProxy` and `ToolCallEmitter`. Document caller responsibility or integrate.

## Verification

### Source Code Check
`McpToolProxy.execute()` (lines 76-116) executes MCP tools and returns a `ToolResult` envelope, but does not call any ACP session update methods. The class has no reference to `ToolCallEmitter` or `AgentSideConnection`.

However, `McpToolCallBridge` (`src/extensions/mcp/tool-call-bridge.ts`) exists specifically for this purpose. Its class doc states:
> "McpToolCallBridge wraps AgentLoop onProgress events to emit ACP tool_call / tool_call_update session updates so clients can observe MCP tool execution in real time."

The bridge hooks into `AgentLoop.onProgress` events (`tool_start`, `tool_complete`, `tool_error`) and emits the appropriate ACP session updates via `ToolCallEmitter`. This is architecturally separate from `McpToolProxy` — the proxy executes tools, the bridge handles ACP visibility.

The `McpToolCallBridge` emits `'in_progress'` on `tool_start` and `'completed'`/`'failed'` on `tool_complete`/`tool_error`. However, it does NOT emit the initial `tool_call` with `status: 'pending'` — it goes directly to `in_progress`. The ACP spec requires `pending` before `in_progress`.

### ACP Spec Check
KB `06-tools-mcp.md` lines 14-28 define the tool call lifecycle:
```
pending → (optional permission gate) → running → completed
                                              → failed
```

KB `04-prompt-turn.md` lines 143-157 show `tool_call` (initial) always has `status: "pending"`. `tool_call_update` then transitions to `in_progress`.

The `McpToolCallBridge` skips `pending` and goes straight to emitting `tool_call` with `in_progress`. This violates the required lifecycle.

### Verdict: PARTIAL
The original issue is partially correct. `McpToolProxy` not having notifications is by design — `McpToolCallBridge` handles that separation. However, the bridge itself has a real ACP compliance issue: it emits `tool_call` with `status: 'in_progress'` directly, skipping the required `pending` state. The issue description is imprecise but points at a real protocol gap.

## Remediation
1. In `McpToolCallBridge.makeProgressHandler()`, on `tool_start`:
   - First emit `tool_call` with `status: 'pending'` (announcement)
   - Then immediately emit `tool_call_update` with `status: 'in_progress'` (execution started)
   ```typescript
   // Announce pending
   await emitter.emitToolCall(sessionId, toolCallId, event.toolName, title, 'pending', meta);
   // Transition to in_progress
   await emitter.emitToolCallUpdate(sessionId, toolCallId, 'in_progress', meta);
   ```
2. Add a JSDoc comment on `McpToolProxy.execute()` explicitly stating: "ACP visibility (tool_call notifications) is the responsibility of McpToolCallBridge, not this class."
