# Wave 2 — Agent 7: WRFC Orchestration Review

**Scope**: `src/extensions/wrfc/orchestrator.ts`, `src/extensions/wrfc/machine.ts`, `src/extensions/wrfc/handlers.ts`, `src/extensions/wrfc/index.ts`, `src/extensions/wrfc/wrfc-event-bridge.ts`, `src/extensions/review/scoring.ts`, `src/extensions/acp/tool-call-emitter.ts`

**KB References**: `06-tools-mcp.md`, `04-prompt-turn.md`, `08-extensibility.md`

---

## Issues

### 1. Tool Call ID Reuse Across Retry Cycles (Known)
- **File**: `src/extensions/wrfc/wrfc-event-bridge.ts`, lines 263-271
- **KB**: `06-tools-mcp.md` line 93 — `toolCallId` must be unique within a session
- **Severity**: HIGH
- **Detail**: `_toolCallId()` generates deterministic IDs as `wrfc_${phase}_${workId}`. When a WRFC chain cycles through review→fix→check→review, the second review phase reuses the same tool call ID `wrfc_review_${workId}`. The ACP spec requires tool call IDs to be unique within a session. The `_activeToolCalls` map returns the cached ID on subsequent lookups, so the client receives a `tool_call` announcement with a previously-completed `toolCallId`.
- **Fix**: Append an attempt counter or generate a fresh UUID per phase invocation.

### 2. Review Not-Passed Maps to `'failed'` Status (Known)
- **File**: `src/extensions/wrfc/wrfc-event-bridge.ts`, line 199
- **KB**: `06-tools-mcp.md` lines 21-28 — `failed` means the tool errored or was denied/cancelled
- **Severity**: MEDIUM
- **Detail**: `const status: acp.ToolCallStatus = p.passed ? 'completed' : 'failed'` maps a review that didn't meet the score threshold to `'failed'`. Per the ACP spec, `failed` indicates the tool itself errored — not that the logical outcome was negative. A review that completes and returns a below-threshold score is semantically `'completed'` with result content indicating the score. Using `'failed'` misleads ACP clients into thinking the review tool broke.
- **Fix**: Always use `'completed'` for review tool calls that ran successfully. Encode pass/fail semantics in the content and `_meta` (which already contains `_goodvibes/passed`).

### 3. ToolCallStatus Value Inconsistency Between KB Documents (Known)
- **File**: `src/extensions/wrfc/wrfc-event-bridge.ts`, lines 124, 146, 168
- **KB**: `06-tools-mcp.md` line 114 says `'running'`; `04-prompt-turn.md` line 207 says `'in_progress'`
- **Severity**: LOW (KB inconsistency, not code bug per se)
- **Detail**: The code uses `'in_progress'` which aligns with `04-prompt-turn.md` and the SDK's `ToolCallStatus` type. However, `06-tools-mcp.md` documents the lifecycle as `pending → running → completed|failed`. The two KB documents disagree on the intermediate status name. The code follows the SDK type definition, which is the authoritative source.
- **Recommendation**: Reconcile KB documents. No code change needed.

### 4. ToolCallKind Values Inconsistency Between KB Documents
- **File**: `src/extensions/wrfc/wrfc-event-bridge.ts`, lines 114, 137, 159
- **KB**: `06-tools-mcp.md` lines 103-112 lists `'execute'|'think'|'edit'|...`; `04-prompt-turn.md` lines 151-156 lists `'read'|'write'|'run'|'switch_mode'|'other'`
- **Severity**: LOW
- **Detail**: The code uses `'execute'`, `'think'`, and `'edit'` (from `06-tools-mcp.md`). The `04-prompt-turn.md` document shows a different set of kinds. The code relies on the SDK's `ToolKind` type which includes the values used. Like issue #3, this is a KB inconsistency rather than a code defect.
- **Recommendation**: Reconcile KB documents.

### 5. Missing `locations` on Completed Tool Call Updates
- **File**: `src/extensions/wrfc/wrfc-event-bridge.ts`, lines 185-190, 203-209, 221-226
- **KB**: `06-tools-mcp.md` lines 72-78, 119-127 — `tool_call_update` supports `locations` for files affected
- **Severity**: MEDIUM
- **Detail**: When the work phase completes, the bridge has access to `filesModified` in the payload but does not include them as `locations` on the `tool_call_update`. The KB examples show `locations` as an array of `{ path, startLine?, endLine? }` on completed tool calls, which enables clients to render file-change indicators. The data is available but not surfaced.
- **Fix**: Map `filesModified` to `FileLocation[]` objects and include them in the `emitToolCallUpdate` call. The `ToolCallEmitter.emitToolCallUpdate` method would need a `locations` parameter added.

### 6. Silent Error Swallowing on All Emit Calls
- **File**: `src/extensions/wrfc/wrfc-event-bridge.ts`, lines 120, 128, 143, 150, 165, 172, 190, 209, 226
- **KB**: `08-extensibility.md` — general implementation quality concern
- **Severity**: MEDIUM
- **Detail**: Every `_emitter.emitToolCall()` and `_emitter.emitToolCallUpdate()` call chains `.catch(() => {})`, silently discarding all errors. If the ACP connection is broken, the bridge has no visibility into failures — no logging, no error events, no metrics. This makes debugging production issues extremely difficult.
- **Fix**: At minimum, log errors with a structured logger. Ideally, emit an internal event (e.g., `wrfc:bridge-error`) so monitoring can detect ACP communication failures.

### 7. Orchestrator Emits `wrfc:work-complete` Before Machine Transitions to `reviewing`
- **File**: `src/extensions/wrfc/orchestrator.ts`, lines 194-201
- **KB**: `06-tools-mcp.md` — tool call lifecycle ordering
- **Severity**: LOW
- **Detail**: The orchestrator calls `machine.transition(WRFC_EVENTS.WORK_DONE)` at line 194, which triggers the `onTransition` callback and emits `wrfc:state-changed` (transitioning to `reviewing`). Then at line 197 it emits `wrfc:work-complete`. The bridge listens for `wrfc:state-changed` to `'reviewing'` to announce the review tool call. This means the review `tool_call` (pending) is announced *before* the work `tool_call_update` (completed) arrives — the ordering may confuse ACP clients that expect a tool call to complete before the next one starts.
- **Recommendation**: Emit `wrfc:work-complete` before the state transition, or ensure the bridge handles the ordering explicitly.

### 8. `ToolCallEmitter` Spreads `sessionUpdate` Type via Object Spread
- **File**: `src/extensions/acp/tool-call-emitter.ts`, lines 55-58, 84-87
- **KB**: `06-tools-mcp.md` lines 90-101 — shape of `tool_call` and `tool_call_update` updates
- **Severity**: LOW
- **Detail**: The emitter constructs the update object and then spreads it into the `sessionUpdate` call: `{ sessionUpdate: 'tool_call', ...toolCall } as acp.SessionUpdate`. This pattern relies on a type assertion (`as acp.SessionUpdate`) to bypass type checking. If the `acp.SessionUpdate` type changes (e.g., adds required fields), the assertion silently masks the error. Additionally, the `toolCall` object already contains `status: 'pending'` but the spread could theoretically be overridden.
- **Recommendation**: Use explicit field construction matching the SDK's expected shape, or validate the constructed object conforms to the interface without assertions.

### 9. Chain-Complete Handler Does Not Emit Final Tool Call Updates
- **File**: `src/extensions/wrfc/wrfc-event-bridge.ts`, lines 231-241
- **KB**: `06-tools-mcp.md` — all tool calls should reach terminal status
- **Severity**: MEDIUM
- **Detail**: The `wrfc:chain-complete` handler only cleans up the `_activeToolCalls` map. If the chain completes due to escalation or failure (not passing through the normal work/review/fix complete events), any in-progress tool calls will never receive a terminal status update (`completed`/`failed`). ACP clients may show these tool calls as perpetually "in progress."
- **Fix**: Before clearing the map, iterate active tool calls and emit terminal `tool_call_update` notifications for any that haven't already been finalized.

### 10. Handlers Directive `target` Field Inconsistency
- **File**: `src/extensions/wrfc/handlers.ts`, lines 161, 191
- **KB**: Internal consistency concern
- **Severity**: LOW
- **Detail**: The `_onWorkComplete` handler creates a directive with `target: 'reviewer'` and `_onReviewComplete` creates one with `target: 'fixer'`, but `_onChainComplete` and `_onCancelled` omit the `target` field entirely. If directive consumers filter by target, the completion and cancellation directives may not be routed correctly. The `Directive` type likely makes `target` optional, but the inconsistency suggests an oversight.
- **Recommendation**: Set an explicit target (e.g., `'orchestrator'`) on chain-complete and cancelled directives, or document why they intentionally lack one.

---

## Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | HIGH | wrfc-event-bridge.ts | Tool call ID reuse across retry cycles |
| 2 | MEDIUM | wrfc-event-bridge.ts | Review not-passed mapped to `'failed'` status |
| 3 | LOW | wrfc-event-bridge.ts | KB inconsistency: `running` vs `in_progress` |
| 4 | LOW | wrfc-event-bridge.ts | KB inconsistency: ToolCallKind value sets |
| 5 | MEDIUM | wrfc-event-bridge.ts | Missing `locations` on completed tool call updates |
| 6 | MEDIUM | wrfc-event-bridge.ts | Silent error swallowing on all emit calls |
| 7 | LOW | orchestrator.ts | Event ordering: review announced before work completed |
| 8 | LOW | tool-call-emitter.ts | Type assertion bypasses compile-time safety |
| 9 | MEDIUM | wrfc-event-bridge.ts | Chain-complete doesn't finalize active tool calls |
| 10 | LOW | handlers.ts | Directive `target` field inconsistency |

**HIGH**: 1 | **MEDIUM**: 4 | **LOW**: 5

---

## Overall Score: 6.5 / 10

The WRFC orchestration module has a solid architectural foundation — the state machine is well-designed with proper guards, the orchestrator correctly drives the work→review→fix→check loop, and the event bridge pattern cleanly separates ACP concerns from domain logic. However, the ACP protocol compliance has several gaps: the tool call ID reuse issue (#1) is a spec violation, the semantic misuse of `'failed'` for below-threshold reviews (#2) misrepresents outcomes to clients, and the lack of terminal status updates on chain completion (#9) can leave clients in inconsistent state. The silent error swallowing (#6) is a maintainability concern. The KB inconsistencies (#3, #4) are not code defects but should be resolved to prevent future confusion.
