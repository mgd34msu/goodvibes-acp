# ACP Compliance Review: Agent Spawner & Loop (Wave 2, Agent 4)

**Iteration**: 3 (fresh review, all prior issues resolved)
**Reviewer**: goodvibes:reviewer
**Date**: 2026-03-07
**Score**: 6.8/10
**Issues**: 1 critical, 3 major, 4 minor, 2 nitpick

## Files Reviewed

| File | Lines | Role |
|------|-------|------|
| `src/plugins/agents/spawner.ts` | 411 | Agent lifecycle management, state machine |
| `src/plugins/agents/loop.ts` | 293 | Core agentic prompt-tool-execute loop |
| `src/plugins/agents/types.ts` | 91 | Agent type configs (engineer, reviewer, etc.) |
| `src/plugins/agents/index.ts` | 46 | Plugin registration entry point |
| `src/plugins/agents/providers/anthropic.ts` | 213 | Anthropic SDK ILLMProvider adapter |
| `src/plugins/agents/providers/mock.ts` | 77 | Test double for ILLMProvider |

## KB References

- `docs/acp-knowledgebase/04-prompt-turn.md` (KB-04): StopReason, tool_call lifecycle, session/update types
- `docs/acp-knowledgebase/10-implementation-guide.md` (KB-10): WRFC tool call mapping, agent_message_chunk streaming
- ACP spec (`agentclientprotocol.com/llms-full.txt`): Protocol-level definitions

---

## Issues

### 1. [Critical] `max_tokens` stop reason collapsed to `end_turn`

**File**: `src/plugins/agents/loop.ts:171-172`
**KB Topic**: KB-04 lines 67, 446-460 (StopReason definition)

When the LLM returns `max_tokens`, the loop maps it to `end_turn` in its result. ACP defines `max_tokens` as a distinct StopReason with different semantics ("Maximum token limit reached" vs "LLM finished without requesting more tools"). This causes the ACP layer to report successful completion when the agent was actually truncated mid-response.

```typescript
// Current (line 171-172)
if (response.stopReason === 'end_turn' || response.stopReason === 'max_tokens') {
  return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'end_turn' };
}
```

Should propagate `max_tokens` as its own stop reason so the ACP layer can surface it correctly to clients.

---

### 2. [Major] No `agent_message_chunk` progress events emitted

**File**: `src/plugins/agents/loop.ts:127-136, 152-157`
**KB Topic**: KB-04 lines 91-117 (agent_message_chunk update), KB-10 section 5

The loop uses non-streaming `chat()` and only emits `llm_start`/`llm_complete` progress events. It never emits progress events that map to the ACP `agent_message_chunk` session update type. This means clients see no incremental text output during LLM inference -- the entire response appears at once when the turn completes.

The TODO at line 127 (ISS-060) acknowledges this gap. Until streaming is implemented, the loop should at minimum emit a progress event with the completed text content after each LLM call so the ACP layer can send `agent_message_chunk` updates.

---

### 3. [Major] Cancelled tool executions not reported via progress callback

**File**: `src/plugins/agents/loop.ts:219-227`
**KB Topic**: KB-04 line 207 (ToolCallStatus includes `cancelled`), KB-04 lines 480-488 (session/cancel rules)

When cancellation is detected before tool execution, the loop pushes a `tool_result` with `is_error: true` but does not emit an `onProgress` event. The ACP protocol defines a `cancelled` ToolCallStatus (KB-04 line 207) and requires that the Agent "SHOULD stop all LLM requests and tool invocations as soon as possible" (KB-04 line 484). Without a progress event, the ACP layer cannot send `tool_call_update` with `status: 'cancelled'` to the client.

```typescript
// Missing: this.config.onProgress?.({ type: 'tool_cancelled', turn, toolName: block.name });
```

---

### 4. [Major] Unknown LLM stop reasons silently mapped to `end_turn`, masking `refusal`

**File**: `src/plugins/agents/loop.ts:182-183`
**KB Topic**: KB-04 line 67 (StopReason includes `refusal`)

The fallback at line 182-183 maps all unknown stop reasons to `end_turn`. ACP defines `refusal` as a valid StopReason ("Agent refuses to continue"). If the LLM provider returns a refusal-equivalent stop reason, the loop would silently convert it to `end_turn`, hiding the refusal from the ACP client. The `fromAnthropicStopReason` mapper (anthropic.ts:207) also maps unknown reasons to `end_turn`.

---

### 5. [Minor] `filesModified` always empty due to unimplemented tracking

**File**: `src/plugins/agents/spawner.ts:55-59, 394-396`
**KB Topic**: KB-10 lines 412-419 (WRFC work phase reports `filesModified` to `tool_call_update`)

The `filesModified` field always falls back to `[]` (acknowledged by TODO ISS-038). KB-10 shows the WRFC work phase completion reports `workResult.filesModified` in both the `locations` field and `_meta` of the `tool_call_update`. With this always empty, the ACP client receives no information about which files the agent modified.

---

### 6. [Minor] Extended thinking blocks silently dropped

**File**: `src/plugins/agents/providers/anthropic.ts:191`
**KB Topic**: KB-04 lines 259-285 (agent_thought_chunk update type)

The `fromAnthropicContent` mapper drops all block types except `text` and `tool_use`, including `thinking` blocks. ACP defines `agent_thought_chunk` (KB-04 lines 259-285) as a session update for internal reasoning. By dropping thinking blocks at the provider level, the loop can never emit thought-related progress events, making the `agent_thought_chunk` ACP feature permanently unreachable.

---

### 7. [Minor] Timeout produces non-ACP `error` stop reason

**File**: `src/plugins/agents/spawner.ts:174-181`
**KB Topic**: KB-04 line 67 (valid StopReason values)

When an agent times out, `_settleFromLoop` receives `stopReason: 'error'`. While the comment at loop.ts:74-76 notes this is "an internal extension value," the spawner's `_buildResult` exposes the terminal status (`'failed'`) but the internal loop result's `stopReason: 'error'` has no defined ACP translation path. The L2 ACP layer must handle this translation, but the contract is implicit rather than documented in the type system.

---

### 8. [Minor] Empty `input_schema` fallback is not valid JSON Schema

**File**: `src/plugins/agents/loop.ts:199`
**KB Topic**: KB-10 section 6 (tool definitions in WRFC tool calls)

When a tool has no `inputSchema`, the fallback is `{}` (empty object). A valid JSON Schema object should at minimum be `{ type: 'object' }`. While most LLM providers may tolerate this, it creates a malformed tool definition that could cause unexpected behavior with strict schema validation.

---

### 9. [Nitpick] `AgentLoopResult.stopReason` includes `error` but ACP StopReason does not

**File**: `src/plugins/agents/loop.ts:72-78`
**KB Topic**: KB-04 lines 458-460 (StopReason type definition)

The type explicitly includes `'error'` and documents it as "an internal extension value." While the comment is helpful, using a TypeScript branded type or separate internal enum would make it impossible for `'error'` to accidentally reach the ACP wire, rather than relying on documentation.

---

### 10. [Nitpick] `_splitToolName` returns empty provider name for unnamespaced tools

**File**: `src/plugins/agents/loop.ts:287-291`
**KB Topic**: KB-10 section 6 (tool namespacing)

When a tool name has no `__` separator, `_splitToolName` returns `['', fullName]`. This means the subsequent `find` at line 234 will look for a provider with `name === ''`, which will never match. The tool call will fail with "unknown tool provider" error. While unlikely in practice (all tools are namespaced via `_collectToolDefinitions`), a defensive check or clearer error message would improve debuggability.

---

## Positive Observations

- Well-structured state machine in `spawner.ts` with clear terminal state transitions
- Proper AbortController/signal threading for cancellation across spawner and loop
- Clean separation between LLM provider abstraction and loop logic
- Thoughtful TODOs with issue tracking references (ISS-036, ISS-037, ISS-038, ISS-060)
- Mock provider enables comprehensive unit testing without API calls
- Sequential tool execution to prevent file-modification race conditions (loop.ts:206-207)

## Summary

The agent spawner and loop provide a solid foundation for the agentic execution cycle. The critical gap is the `max_tokens` to `end_turn` stop reason collapse, which causes the ACP layer to misreport truncated responses as successful completions. Three major issues relate to incomplete ACP session update coverage: no `agent_message_chunk` streaming, no `tool_cancelled` progress events, and `refusal` stop reason being masked. The minor issues around `filesModified`, thinking blocks, and schema validation are acknowledged TODOs or low-risk gaps that should be addressed before production use.
