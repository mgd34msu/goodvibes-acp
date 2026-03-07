# ISS-141 — Mock Provider Skips tool_use Blocks in stream()

**Severity**: Minor
**File**: src/plugins/agents/providers/mock.ts
**KB Topic**: Implementation Guide

## Original Issue
Mock `stream()` skips `tool_use` blocks — tests cannot exercise the tool execution loop via streaming.

## Verification

### Source Code Check
Lines 59–67 of `src/plugins/agents/providers/mock.ts`:

```typescript
async *stream(params: ChatParams): AsyncIterable<ChatChunk> {
  const response = await this.chat(params);
  for (const block of response.content) {
    if (block.type === 'text') {
      yield { type: 'text_delta', text: block.text };
    }
  }
  yield { type: 'stop', stopReason: response.stopReason, usage: response.usage };
}
```

The comment at line 57 explicitly documents this: "Non-text blocks (tool_use, tool_result) are skipped — only text emits deltas." The issue is exactly as described — `tool_use` content blocks are silently dropped when streaming, so any test that enqueues a response with `tool_use` blocks and calls `stream()` will never see a `tool_use` chunk emitted, making it impossible to test the tool execution loop path via streaming.

### ACP Spec Check
The ACP spec (KB: Implementation Guide, section on tool calls) defines `tool_call` session update notifications as the mechanism for agent-side tool invocation streaming. The `tool_use` content block from the LLM response is what triggers the tool execution loop. If `MockProvider.stream()` silently drops `tool_use` blocks, tests cannot verify that the `AgentLoop` correctly handles tool use in the streaming path.

This is not a wire-format compliance issue — it is a testing infrastructure gap. The ACP spec does not specify anything about mock providers. However, the absence of `tool_use` streaming support in the mock means the streaming path of the agent loop (which must emit `tool_call` session updates per the spec) cannot be integration-tested.

### Verdict: NOT_ACP_ISSUE
The code has the problem described — `tool_use` blocks are indeed skipped. However, this is a testing limitation in a mock class, not an ACP protocol compliance issue. The `MockProvider` is not part of the ACP wire protocol. The real risk is that the agent loop's tool-use streaming path goes untested, but the fix is in test infrastructure, not in ACP compliance.

## Remediation
Add `tool_use` chunk emission to `MockProvider.stream()`:

```typescript
async *stream(params: ChatParams): AsyncIterable<ChatChunk> {
  const response = await this.chat(params);
  for (const block of response.content) {
    if (block.type === 'text') {
      yield { type: 'text_delta', text: block.text };
    } else if (block.type === 'tool_use') {
      yield { type: 'tool_use', id: block.id, name: block.name, input: block.input };
    }
  }
  yield { type: 'stop', stopReason: response.stopReason, usage: response.usage };
}
```

Verify the `ChatChunk` type definition supports a `tool_use` discriminant before applying.
