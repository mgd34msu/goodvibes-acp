# Wave 2 Review — Agent 4: Agent Spawner & Loop

**Reviewer**: ACP Compliance Agent  
**Date**: 2026-03-08  
**Scope**: `src/plugins/agents/loop.ts`, `src/plugins/agents/spawner.ts`, `src/plugins/agents/types.ts`, `src/extensions/agents/tracker.ts`, `src/extensions/agents/coordinator.ts`  
**KB References**: KB-04 (Prompt Turn), KB-06 (Tools & MCP), KB-10 (Implementation Guide)

---

## Issues

### 1. No `agent_message_chunk` streaming during LLM inference
**File**: `src/plugins/agents/loop.ts` lines 139-148  
**KB**: KB-04 lines 91-117 (agent_message_chunk), KB-10 section 5  
**Severity**: HIGH  

The loop uses `provider.chat()` (non-streaming) and never emits `agent_message_chunk` session updates. ACP clients expect streaming text deltas during LLM inference. Without this, the client sees no output until the entire turn completes. Currently tracked as ISS-060 with a TODO, but remains a significant protocol gap.

---

### 2. Unknown stop reasons silently collapse to `end_turn`
**File**: `src/plugins/agents/loop.ts` line 199-200  
**KB**: KB-04 lines 446-460 (StopReason type)  
**Severity**: MEDIUM  

When the LLM provider returns an unrecognized `stopReason`, the loop falls through to return `end_turn`. Per KB-04, the valid stop reasons are `end_turn | max_tokens | max_turn_requests | refusal | cancelled`. An unknown value (e.g., `refusal` from a future provider) would be silently rewritten. The loop should either preserve recognized-but-unhandled reasons or log a warning rather than silently masking them.

---

### 3. Cancelled tools missing ACP `tool_call_update` status events
**File**: `src/plugins/agents/loop.ts` lines 234-244  
**KB**: KB-06 lines 114, 207 (ToolCallStatus lifecycle), KB-04 lines 480-488 (cancel protocol)  
**Severity**: HIGH  

When cancellation is detected before a tool executes (line 236), the loop pushes a `tool_result` content block with `is_error: true` into the LLM message history but does NOT emit a `tool_call_update` progress event with `status: 'cancelled'`. The `onProgress` callback is never called in this path. ACP clients tracking tool call status will never see these tools transition from `pending` to `cancelled`, leaving phantom pending tool calls in the UI. Per KB-04 line 482: "Client SHOULD preemptively mark all non-finished tool calls as cancelled" — but the agent should also emit these updates.

---

### 4. `_splitToolName` returns empty provider for non-namespaced tools
**File**: `src/plugins/agents/loop.ts` lines 304-307  
**KB**: KB-06 line 93 (toolCallId uniqueness), KB-10 section 6 (tool namespacing)  
**Severity**: MEDIUM  

When a tool name has no `__` separator, `_splitToolName` returns `['', fullName]`. The subsequent `provider.find(p => p.name === '')` lookup at line 251 will always fail, producing a misleading error: `unknown tool provider ""`. This should either reject the tool call with a clear error message about missing namespace or use a fallback convention.

---

### 5. `max_tokens` stop reason maps to `completed` agent status
**File**: `src/plugins/agents/spawner.ts` lines 329-331  
**KB**: KB-04 lines 450-453 (max_tokens meaning)  
**Severity**: MEDIUM  

In `_settleFromLoop`, the `max_tokens` stop reason falls through to the `else` branch (line 330) and sets `state.status = 'completed'`. Per KB-04, `max_tokens` means "maximum token limit reached" — the response was truncated. Treating a truncated response as a successful completion loses important signal. The spawner should either mark it as `failed` with a descriptive error or at minimum surface the `max_tokens` stop reason in the `AgentResult` so callers can distinguish it from a clean `end_turn` completion.

---

### 6. Coordinator misses `cancelled` events for queue draining
**File**: `src/extensions/agents/coordinator.ts` lines 58-59  
**KB**: KB-04 lines 480-488 (cancel protocol)  
**Severity**: MEDIUM  

The coordinator subscribes to `agent:completed` and `agent:failed` to drain the spawn queue, but does NOT listen to `agent:cancelled`. Looking at the tracker (line 118), cancelled agents emit via `agent:failed`, so this technically works. However, the semantic coupling is fragile — if the tracker were changed to emit a separate `agent:cancelled` event (which would be more correct), the coordinator would stop draining the queue for cancelled agents. The coordinator should explicitly listen for all three terminal events.

---

### 7. Double `running` status transition in coordinator
**File**: `src/extensions/agents/coordinator.ts` line 185  
**KB**: N/A (internal consistency)  
**Severity**: LOW  

In `_spawnNow`, the coordinator calls `tracker.updateStatus(handle.id, 'running')` at line 185. However, the spawner (`spawner.ts` line 142) already sets `state.status = 'running'` internally before returning the handle. The tracker transition `spawned -> running` happens twice: once implicitly inside the spawner and once explicitly in the coordinator. While `updateStatus` is idempotent for same-state transitions, this creates confusing double `agent:status-changed` events on the EventBus.

---

### 8. `updateStatus` allows arbitrary state transitions
**File**: `src/extensions/agents/tracker.ts` line 82  
**KB**: KB-06 line 217 (status lifecycle: pending -> in_progress -> completed|cancelled|error)  
**Severity**: MEDIUM  

The tracker's `updateStatus` method accepts any `AgentStatus` value with no validation of the transition. Invalid transitions like `completed -> running` or `failed -> completed` are silently accepted and persisted. Per KB-06, tool call status has a defined lifecycle (`pending -> in_progress -> completed|cancelled|error`). Agent status should enforce a similar state machine: `spawned/pending -> running -> completed|failed|cancelled`. Invalid transitions should be rejected or at minimum logged as warnings.

---

### 9. No `refusal` stop reason handling in agent loop
**File**: `src/plugins/agents/loop.ts` lines 182-200  
**KB**: KB-04 lines 455 (refusal stop reason)  
**Severity**: LOW  

The loop explicitly handles `end_turn`, `max_tokens`, and `tool_use` stop reasons but has no case for `refusal`. ACP defines `refusal` as "Agent refuses to continue." If the LLM returns a refusal stop reason, it falls through to the unknown-reason handler (line 200) and is silently converted to `end_turn`. This masks a meaningful signal — the caller cannot distinguish between a normal completion and a refusal. The loop should propagate `refusal` as a distinct stop reason.

---

### 10. Agent loop does not pass `cwd`/`workspaceRoots` from AgentConfig
**File**: `src/plugins/agents/spawner.ts` lines 156-164  
**KB**: KB-10 lines 197-198 (session/new cwd and workspaceRoots)  
**Severity**: LOW  

When constructing the `AgentLoop`, the spawner does not pass `cwd` or `workspaceRoots` from the `AgentConfig` to `AgentLoopConfig`. The `AgentLoopConfig` interface supports these fields (lines 47-49), but they are never populated. Per KB-10, `cwd` is extracted from `session/new` and used for context enrichment. Agents spawned without `cwd` will have no working directory context in their enriched system prompt.

---

## Summary

| # | File | Severity | Category |
|---|------|----------|----------|
| 1 | loop.ts:139-148 | HIGH | Missing streaming (agent_message_chunk) |
| 2 | loop.ts:199-200 | MEDIUM | Unknown stop reasons silently become end_turn |
| 3 | loop.ts:234-244 | HIGH | Cancelled tools missing ACP tool_call_update |
| 4 | loop.ts:304-307 | MEDIUM | Empty provider name on non-namespaced tools |
| 5 | spawner.ts:329-331 | MEDIUM | max_tokens treated as completed |
| 6 | coordinator.ts:58-59 | MEDIUM | Missing cancelled event listener for queue drain |
| 7 | coordinator.ts:185 | LOW | Double running status transition |
| 8 | tracker.ts:82 | MEDIUM | No state transition validation |
| 9 | loop.ts:182-200 | LOW | refusal stop reason not handled |
| 10 | spawner.ts:156-164 | LOW | cwd/workspaceRoots not passed to loop |

**HIGH**: 2 | **MEDIUM**: 5 | **LOW**: 3

---

## Overall Score: 6/10

The agent loop, spawner, tracker, and coordinator form a functional foundation with correct basic structure. The tool execution cycle works, cancellation is implemented with AbortController, timeout handling is solid, and the coordinator enforces concurrency limits with queue draining.

However, two high-severity ACP protocol gaps remain: the complete absence of streaming (`agent_message_chunk`) and missing `tool_call_update` events for cancelled tools. These are critical for ACP client interoperability. The medium-severity issues around stop reason handling (`max_tokens` as completed, unknown reasons as `end_turn`, no `refusal`) mean the ACP wire protocol loses meaningful signal about how and why agent turns ended. The lack of state transition validation in the tracker could lead to inconsistent state in production.

The codebase shows awareness of these gaps (ISS-060 TODO, comments referencing KB sections), which is positive. Once the streaming path and stop reason fidelity are addressed, this subsystem will be well-aligned with the ACP specification.
