# ISS-023 — Tool Call Content Placed in `_meta` Instead of `content` Field

**Severity**: Major
**File**: src/extensions/mcp/tool-call-bridge.ts:119-121, 140-143
**KB Topic**: Tool Call Update Content Blocks (06-tools-mcp.md lines 69-71, 124-127, 530-533)

## Original Issue
Actual tool output is placed inside `_meta` under `'_goodvibes/content'` and `'_goodvibes/error'` instead of the standard `content` field. The `emitToolCallUpdate` `content` parameter is never used.

## Verification

### Source Code Check
For `tool_complete` (around line 119-121):
```typescript
emitter
  .emitToolCallUpdate(
    sessionId,
    toolCallId,
    'completed',
    {
      '_goodvibes/durationMs': event.durationMs,
      '_goodvibes/content': [{ type: 'text', text: '' }],
    },
  )
```

For `tool_error` (around line 140-143):
```typescript
emitter
  .emitToolCallUpdate(
    sessionId,
    toolCallId,
    'failed',
    {
      '_goodvibes/error': event.error,
      '_goodvibes/content': [{ type: 'text', text: String(event.error ?? 'Unknown error') }],
    },
  )
```

The content blocks are placed inside the `_meta` object under vendor-prefixed keys. The actual `content` parameter of `emitToolCallUpdate` is never populated with tool output.

### ACP Spec Check
KB-06 (06-tools-mcp.md) defines `ToolCallStatusUpdate` with a direct `content?: ContentBlock[]` field (line 124). The reference implementation (lines 530-533) shows:
```typescript
update: {
  sessionUpdate: 'tool_call_update',
  toolCallId,
  status: mcpResult.isError ? 'failed' : 'completed',
  content: mcpResult.content,  // MCP ContentBlock[] directly
},
```
The spec explicitly states: "MCP content blocks should be forwarded directly as ACP content" and "ACP uses the same `ContentBlock` schema as MCP."

### Verdict: CONFIRMED
Tool output is placed in `_meta` vendor-prefixed fields instead of the standard `content` field. ACP-compliant clients will not find tool output where they expect it. The `_meta` field is for extensibility metadata, not primary display content.

## Remediation
1. Pass MCP tool result content blocks directly as the `content` parameter of `emitToolCallUpdate`
2. Keep vendor-specific metadata (like `durationMs`) in `_meta` where it belongs
3. For errors, place the error message in `content` as a text ContentBlock
4. Example fix for `tool_complete`:
   ```typescript
   emitter.emitToolCallUpdate(sessionId, toolCallId, 'completed', 
     { '_goodvibes/durationMs': event.durationMs },
     event.content  // pass as content parameter, not in _meta
   )
   ```
