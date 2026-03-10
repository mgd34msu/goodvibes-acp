# ISS-011: No `agent_message_chunk` streaming during LLM inference

**Severity**: Critical  
**File**: `src/plugins/agents/loop.ts`  
**Lines**: 139-148  
**KB Reference**: KB-04 (Prompt Turn)

## Description

The agent loop uses non-streaming `provider.chat()` and never emits `agent_message_chunk` session updates. ACP clients expect streaming text deltas during inference.

## Evidence

Lines 139-148 contain a TODO (ISS-060) explicitly acknowledging the gap:
```
// TODO ISS-060: This uses non-streaming chat(). Switch to provider.stream()
```
The `provider.chat()` call returns a complete response. No `agent_message_chunk` session updates are emitted at any point in the loop.

The SDK `SessionUpdate` union includes `(ContentChunk & { sessionUpdate: "agent_message_chunk" })` as a valid update type.

### Verdict: CONFIRMED

The code uses synchronous (non-streaming) LLM calls and emits zero `agent_message_chunk` updates. ACP clients receive no incremental output during inference.

## Remediation

1. Replace `provider.chat()` with a streaming equivalent (e.g., `provider.stream()`) returning `AsyncIterable<ChatChunk>`.
2. For each text delta chunk, emit a `sessionUpdate` with `sessionUpdate: 'agent_message_chunk'` and the chunk content.
3. Wire the `onProgress` callback to the ACP session update emitter.
4. Add `AgentLoopConfig.streaming?: boolean` (default `true`) for test compatibility.
