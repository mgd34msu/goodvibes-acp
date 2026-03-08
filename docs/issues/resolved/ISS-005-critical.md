# ISS-005 — Empty content block forwarded on completed tool calls — tool output discarded

**Severity**: Critical
**File**: `src/extensions/mcp/tool-call-bridge.ts`
**KB Topic**: KB-06: MCP ContentBlock Forwarding

## Original Issue
The completed `tool_call_update` emits a hardcoded empty content block `[{ type: 'content', content: { type: 'text', text: '' } }]`. Per KB-06, the actual MCP result content should be forwarded directly to the ACP client. The current implementation discards all tool output, meaning the ACP client never sees what the tool returned.

## Verification

### Source Code Check
Line 130 of `src/extensions/mcp/tool-call-bridge.ts`:
```typescript
emitter
  .emitToolCallUpdate(
    sessionId,
    toolCallId,
    'completed',
    { '_goodvibes/durationMs': event.durationMs },
    // ISS-023: pass content blocks as the content parameter, not inside _meta
    [{ type: 'content', content: { type: 'text', text: '' } }],
  )
```

The content is hardcoded as an empty text block. The comment (ISS-023) acknowledges this should contain actual content.

### ACP Spec Check
KB-06 lines 525-534 show the expected behavior:
```typescript
// 4. Forward MCP content blocks directly to ACP (same ContentBlock schema)
await acpConn.sessionUpdate({
  sessionId,
  update: {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: mcpResult.isError ? 'failed' : 'completed',
    content: mcpResult.content,  // MCP ContentBlock[] is directly compatible with ACP
  },
});
```

KB-06 line 540: "ACP uses the same ContentBlock schema as MCP. MCP tool output can be forwarded to ACP content without transformation."

### Verdict: CONFIRMED
The code discards all MCP tool output by emitting an empty content block. This is a clear violation of KB-06 which states MCP content blocks should be forwarded directly. The ACP client will never see tool results, making tool call output invisible.

## Remediation
1. Pass the actual MCP tool result content blocks from the `tool_complete` progress event into the `emitToolCallUpdate` call.
2. The `tool_complete` event should carry the MCP result content; forward `event.content` or `event.result.content` directly.
3. If the bridge event doesn't currently carry content, update the MCP bridge event type to include the MCP result content blocks.
