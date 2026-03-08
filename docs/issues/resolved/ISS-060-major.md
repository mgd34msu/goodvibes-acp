# ISS-060 — AgentLoop Uses Non-Streaming chat() — Cannot Emit agent_message_chunk Updates

**Severity**: Major
**File**: src/plugins/agents/loop.ts:84-172
**KB Topic**: Prompt Turn — Streaming (04-prompt-turn.md lines 91-117)

## Original Issue
The agent loop uses only the non-streaming `chat()` method. The L2 ACP layer cannot emit `agent_message_chunk` streaming updates during LLM inference.

## Verification

### Source Code Check
The agent loop at line 120 calls:
```typescript
response = await this.config.provider.chat(params);
```
This is a non-streaming call that returns the complete response only after full inference. The `LLMProvider` interface (in `src/types/registry.ts` line 275) does define a `stream()` method:
```typescript
stream(params: ChatParams): AsyncIterable<ChatChunk>;
```
And concrete providers (e.g., `AnthropicProvider` at line 54) implement it. But `AgentLoop` never calls `stream()` — it only uses `chat()`.

### ACP Spec Check
KB-04 (lines 91-117) defines `agent_message_chunk`:
> "Streaming text from the LLM. Multiple chunks form the complete agent message."

The spec provides the wire format:
```typescript
interface AgentMessageChunkUpdate {
  sessionUpdate: "agent_message_chunk";
  content: ContentBlock;
}
```
This update type enables real-time streaming of LLM output to clients. Without streaming, the entire response is sent only after inference completes, degrading the user experience.

### Verdict: CONFIRMED
The `AgentLoop` exclusively uses `chat()` (non-streaming). The `stream()` method exists on the provider interface and is implemented by providers, but is never called. This makes it impossible for the ACP layer to emit `agent_message_chunk` updates during inference.

## Remediation
1. Modify `AgentLoop.run()` to use `this.config.provider.stream(params)` instead of `chat()`
2. Iterate over the `AsyncIterable<ChatChunk>` to:
   a. Emit `agent_message_chunk` updates via `onProgress` callback for each text chunk
   b. Accumulate content blocks for the complete response
   c. Handle tool use blocks when the stream indicates tool calls
3. Add a `streaming` option to `AgentLoopConfig` (default `true`) so non-streaming mode remains available for testing
4. Wire the `onProgress` callback to the ACP session update emitter so chunks reach the client
