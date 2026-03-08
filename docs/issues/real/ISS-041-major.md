# ISS-041 — No agent_message_chunk progress events emitted

**Severity**: Major
**File**: `src/plugins/agents/loop.ts`
**KB Topic**: KB-04: Agent Message Streaming

## Original Issue
The loop uses non-streaming `chat()` and only emits `llm_start`/`llm_complete` progress events. It never emits progress events mapping to ACP `agent_message_chunk` session update type. The entire response appears at once when the turn completes. Acknowledged as ISS-060.

## Verification

### Source Code Check
Lines 127-136 contain a TODO comment (ISS-060) confirming the code uses `chat()` instead of `stream()`. Only two progress events are emitted:
- `llm_start` at line 116
- `llm_complete` at lines 152-157

No `agent_message_chunk` events are emitted anywhere in the file.

### ACP Spec Check
KB-04 line 91 defines `agent_message_chunk` as a session update type for incremental streaming. The spec describes it as the mechanism for clients to see partial agent output during LLM inference. Without it, clients receive no incremental output.

### Verdict: CONFIRMED
The code explicitly acknowledges this gap via the ISS-060 TODO comment. The `chat()` call returns a complete response, and no chunk-level progress events are emitted. This is a genuine ACP compliance gap.

## Remediation
1. Replace `chat()` with `stream()` returning `AsyncIterable<ChatChunk>`
2. Accumulate content blocks and emit `onProgress({ type: 'agent_message_chunk', chunk })` for each text delta
3. Handle tool_use blocks when the stream signals tool calls
4. Add `AgentLoopConfig.streaming?: boolean` (default true) for test compatibility
5. Wire `onProgress` to the ACP session update emitter so chunks reach the client
