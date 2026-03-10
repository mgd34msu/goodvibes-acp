# ISS-022 — MCP content blocks not forwarded directly to ACP

**Severity**: Major
**File**: `src/extensions/mcp/tool-call-bridge.ts`, `src/extensions/mcp/tool-proxy.ts`
**Lines**: 131-133 (bridge), 94-111 (proxy)
**KB Reference**: KB-06 (MCP Tools)

## Description

KB-06 explicitly states: "MCP ContentBlock[] is directly compatible with ACP" and shows MCP tool output being forwarded as `content: mcpResult.content` without transformation. The implementation in `tool-call-bridge.ts` (line 131-133) instead re-wraps the MCP result data into a single text content block:

```typescript
[{ type: 'content', content: { type: 'text', text: typeof event.result.data === 'string' ? event.result.data : JSON.stringify(event.result.data ?? '') } }]
```

This loses image blocks, resource blocks, and any structured content from MCP tool results. Additionally, `tool-proxy.ts` returns the raw MCP result inside a `ToolResult` envelope without preserving the content block array structure.

### Verdict: CONFIRMED

The source code wraps all MCP results as text strings. KB-06 lines 525-540 explicitly require direct forwarding of MCP ContentBlock[] to ACP without transformation.

## Remediation

1. In `McpToolCallBridge`, access the original MCP `content` array from the tool result rather than serializing `event.result.data` to text
2. Forward `mcpResult.content` directly as the ACP `ToolCallContent[]` in `emitToolCallUpdate`
3. In `McpToolProxy`, preserve the MCP content block array on the `ToolResult` so it is available to the bridge
4. Handle empty content arrays correctly (forward `[]` rather than wrapping empty string)
