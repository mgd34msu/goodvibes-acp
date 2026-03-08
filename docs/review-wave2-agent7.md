# ACP Compliance Review — WRFC Orchestration (Wave 2, Agent 7, Iteration 3)

**Reviewer:** goodvibes:reviewer  
**Date:** 2026-03-07  
**Scope:** `src/extensions/wrfc/orchestrator.ts`, `src/extensions/wrfc/machine.ts`, `src/extensions/wrfc/handlers.ts`, `src/extensions/wrfc/index.ts`, `src/extensions/wrfc/wrfc-event-bridge.ts`, `src/extensions/review/scoring.ts`  
**KB Files:** `04-prompt-turn.md`, `06-tools-mcp.md`, `10-implementation-guide.md`  
**ACP Spec:** `https://agentclientprotocol.com/llms-full.txt` (fetched once)  
**Score: 8.2/10** | **Issues: 0 critical, 3 major, 4 minor, 1 nitpick**

---

## Summary

The WRFC orchestration layer is well-structured with clean separation between state machine logic (`machine.ts`), orchestration flow (`orchestrator.ts`), event handling (`handlers.ts`), and ACP bridging (`wrfc-event-bridge.ts`). Layer boundaries are respected (L2 imports only from L0 types and L1 core). The core WRFC lifecycle is sound. Issues found relate primarily to ACP tool_call status semantics, missing content/locations fields on tool_call_update emissions, and a tool call ID reuse problem across multi-attempt WRFC cycles.

---

## Issues

### 1. Review failure mapped to `'failed'` tool_call status instead of `'completed'`

| Field | Value |
|-------|-------|
| **File** | `src/extensions/wrfc/wrfc-event-bridge.ts` |
| **Line** | 196 |
| **KB Topic** | `06-tools-mcp.md` lines 22-28, `04-prompt-turn.md` line 207 |
| **Severity** | Major |

When a review does not pass, the bridge maps it to `'failed'` status:
```typescript
const status: acp.ToolCallStatus = p.passed ? 'completed' : 'failed';
```

Per ACP spec, `failed` (or `error`) means the tool itself errored during execution — not that its output was unfavorable. A review that completes with a low score is a successful tool execution that produced an unfavorable result. The score metadata (`_goodvibes/score`, `_goodvibes/passed`) already conveys pass/fail semantics. Clients may surface `failed` tool calls as errors in UI, confusing users.

**Fix:** Always emit `'completed'` for reviews that finish execution. Use `_meta` to distinguish pass from fail.

---

### 2. Tool call ID reuse across multi-attempt WRFC cycles

| Field | Value |
|-------|-------|
| **File** | `src/extensions/wrfc/wrfc-event-bridge.ts` |
| **Line** | 254-261 |
| **KB Topic** | `06-tools-mcp.md` lines 93, 621 |
| **Severity** | Major |

The `_toolCallId` method generates IDs as `wrfc_${phase}_${workId}` and caches them in `_activeToolCalls`. In a multi-attempt WRFC chain, the review phase runs multiple times (attempt 1, attempt 2, etc.), but the same `workId:review` key maps to the same cached tool call ID. Per ACP spec: `toolCallId` must be unique within a session, and each `tool_call` announcement creates a new tool call.

Reusing the same ID means the second review `tool_call` announcement would collide with the first (already completed) one. Clients tracking tool calls by ID would overwrite or conflate the two.

**Fix:** Include the attempt number in the tool call ID: `wrfc_${phase}_${attempt}_${workId}`. Clear stale entries when a phase re-enters.

---

### 3. Missing `content` field on work-complete tool_call_update

| Field | Value |
|-------|-------|
| **File** | `src/extensions/wrfc/wrfc-event-bridge.ts` |
| **Line** | 183-187 |
| **KB Topic** | `06-tools-mcp.md` lines 69-70, `10-implementation-guide.md` lines 413-414 |
| **Severity** | Major |

The work-complete handler emits a `tool_call_update` with `status: 'completed'` and `_meta` but no `content` field. Per `06-tools-mcp.md` line 69 and the implementation guide (line 414), completed tool calls should include `content` blocks with the tool's output text (e.g., a summary of files modified). Similarly, no `locations` field is emitted, which the implementation guide (line 415) shows should include `filesModified.map(f => ({ path: f }))`.

The same omission applies to the fix-complete handler (line 213) and review-complete handler (line 198).

**Fix:** Pass `content` and `locations` arrays from the event payload through to the tool_call_update emission.

---

### 4. All WRFC phases use `kind: 'other'` instead of semantically appropriate kinds

| Field | Value |
|-------|-------|
| **File** | `src/extensions/wrfc/wrfc-event-bridge.ts` |
| **Line** | 114, 136, 158 |
| **KB Topic** | `06-tools-mcp.md` lines 103-112, `10-implementation-guide.md` line 434 |
| **Severity** | Minor |

All three WRFC phases (work, review, fix) use `kind: 'other'`. The ACP `ToolCallKind` enum provides semantically appropriate values: `'execute'` for work (running commands/code), `'think'` for review (internal reasoning), and `'edit'` for fix (modifying files). The implementation guide (line 434) explicitly uses `'think'` for the review phase.

Using appropriate kinds allows ACP clients to render phase-specific icons and UI treatments.

**Fix:** Map phases to kinds: work -> `'execute'`, review -> `'think'`, fix -> `'edit'`.

---

### 5. KB documents have contradictory `ToolCallStatus` enum definitions

| Field | Value |
|-------|-------|
| **File** | `docs/acp-knowledgebase/04-prompt-turn.md` vs `docs/acp-knowledgebase/06-tools-mcp.md` |
| **Line** | 04: line 207, 06: line 114 |
| **KB Topic** | `04-prompt-turn.md`, `06-tools-mcp.md` |
| **Severity** | Minor |

Two KB documents define `ToolCallStatus` differently:
- `04-prompt-turn.md:207`: `"pending" | "in_progress" | "completed" | "cancelled" | "error"`
- `06-tools-mcp.md:114`: `'pending' | 'running' | 'completed' | 'failed'`

The source code uses the SDK's `acp.ToolCallStatus` type (which uses `in_progress`), aligning with `04-prompt-turn.md`. However, having contradictory KB docs creates risk for future implementers.

This is not a code issue but a documentation issue that should be reconciled.

---

### 6. Swallowed errors in bridge event handlers via `.catch(() => {})`

| Field | Value |
|-------|-------|
| **File** | `src/extensions/wrfc/wrfc-event-bridge.ts` |
| **Line** | 120, 128, 143, 150, 165, 172, 187, 203, 217 |
| **KB Topic** | `10-implementation-guide.md` (error handling patterns) |
| **Severity** | Minor |

All `emitToolCall` and `emitToolCallUpdate` calls use `.catch(() => {})` which silently swallows errors. If the ACP connection drops or `sessionUpdate` throws, the bridge has no visibility into the failure. There is no logging, no metric, and no fallback.

While it is reasonable to not let ACP notification failures crash the WRFC orchestrator, completely silent swallowing makes debugging production issues very difficult.

**Fix:** Replace empty catches with logging: `.catch((err) => console.error('[WRFCEventBridge] Failed to emit tool call update', err))`.

---

### 7. `WRFCEventBridge` state-changed handler does not handle `'checking'` state

| Field | Value |
|-------|-------|
| **File** | `src/extensions/wrfc/wrfc-event-bridge.ts` |
| **Line** | 106-173 |
| **KB Topic** | `10-implementation-guide.md` lines 341-345 |
| **Severity** | Minor |

The state-changed handler emits tool_call announcements for `working`, `reviewing`, and `fixing` transitions, but not for `checking`. The `checking` state is a post-fix re-review (per `machine.ts` lines 162-167). When the machine transitions to `checking`, no tool_call is emitted to the ACP client, creating a visibility gap in the WRFC lifecycle.

The `review-complete` event handler (line 193) handles the review result for both `reviewing` and `checking` states, but the ACP client never sees a tool_call announcement for the check phase.

**Fix:** Add a `checking` branch that emits a tool_call with a descriptive title like `'Verifying fix...'`.

---

### 8. `ToolCallEmitter.emitToolCall` builds `_meta` unconditionally when `name` is provided

| Field | Value |
|-------|-------|
| **File** | `src/extensions/acp/tool-call-emitter.ts` |
| **Line** | 50-52 |
| **KB Topic** | `06-tools-mcp.md` line 100 |
| **Severity** | Nitpick |

The conditional `meta || name` always evaluates truthy since `name` is a required parameter (never empty in practice), so the `_meta` object is always included. The ternary is dead code — the falsy branch never executes. This is not incorrect but adds unnecessary complexity.

**Fix:** Simplify to always include `_meta: { ...(meta ?? {}), '_goodvibes/tool_name': name }`.

---

## Category Breakdown

| Category | Score | Key Findings |
|----------|-------|--------------|
| Security | 10/10 | No security concerns in orchestration layer |
| Error Handling | 7/10 | Swallowed errors in bridge (.catch(() => {})) |
| Testing | N/A | Not in scope |
| Organization | 9/10 | Clean layer separation, clear module boundaries |
| Performance | 9/10 | No performance concerns identified |
| SOLID/DRY | 8/10 | Bridge handler pattern has repetitive structure |
| Naming | 9/10 | Clear naming throughout |
| Maintainability | 8/10 | Good structure, some dead-code complexity |
| ACP Compliance | 7/10 | Status semantics, missing content/locations, ID reuse |
| Documentation | 9/10 | Good JSDoc, clear module headers |

---

## Recommendations

1. **Immediate (before merge):** Fix tool call ID reuse (#2) — this will cause client-side bugs in multi-attempt WRFC chains.
2. **Immediate:** Change review-not-passed from `'failed'` to `'completed'` (#1) — ACP clients will misrender this.
3. **This PR:** Add `content` and `locations` to tool_call_update emissions (#3) — matches implementation guide spec.
4. **Follow-up:** Reconcile KB `ToolCallStatus` definitions (#5) between `04-prompt-turn.md` and `06-tools-mcp.md`.
5. **Follow-up:** Replace swallowed errors with logged errors (#6).
