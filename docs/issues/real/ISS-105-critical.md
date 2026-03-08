# ISS-105 — Empty content block forwarded on completed tool calls — tool output discarded

**Severity**: Critical  
**File**: `src/extensions/mcp/tool-call-bridge.ts`  
**Line**: 130  
**KB Reference**: KB-06 (MCP ContentBlock Forwarding)  
**Iteration**: 3

## Description

The completed `tool_call_update` emits a hardcoded empty content block `[{ type: 'content', content: { type: 'text', text: '' } }]` instead of forwarding the actual MCP tool result. The ACP client never sees what the tool returned.

## Source Evidence

```typescript
// src/extensions/mcp/tool-call-bridge.ts:124-130
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

## Spec Evidence

KB-06 defines `tool_call_update` with:
```typescript
interface ToolCallUpdateUpdate {
  sessionUpdate: "tool_call_update";
  toolCallId: string;
  status: ToolCallStatus;
  content?: ToolCallContent[]; // present on completed/error
}
```

The `content` field should contain the actual MCP result content blocks.

### Verdict: CONFIRMED

The tool output is completely discarded. The `tool_complete` progress event presumably carries the MCP result content, but it is replaced with an empty string content block.

## Remediation

1. Extract the actual MCP tool result content from the `tool_complete` progress event
2. Map the MCP result content blocks to ACP `ToolCallContent[]` format
3. Pass the mapped content into `emitToolCallUpdate` instead of the empty block
4. Example: replace `[{ type: 'content', content: { type: 'text', text: '' } }]` with `mapMcpResultToAcpContent(event.result)`
