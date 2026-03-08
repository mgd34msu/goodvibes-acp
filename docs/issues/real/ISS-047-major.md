# ISS-047 — Review failure mapped to failed tool_call status instead of completed

**Severity**: Major
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**KB Topic**: KB-06: ToolCallStatus Semantics

## Original Issue
When a review does not pass, the bridge maps it to `'failed'` status. Per ACP spec, `failed`/`error` means the tool itself errored during execution — not that its output was unfavorable. A review that completes with a low score is a successful tool execution.

## Verification

### Source Code Check
Line 196:
```typescript
const status: acp.ToolCallStatus = p.passed ? 'completed' : 'failed';
```
When a review finishes but `passed` is false, the tool call status is set to `'failed'`.

### ACP Spec Check
KB-06 line 27-28 defines the ToolCallStatus values:
- `completed` — Tool finished successfully
- `failed` — Tool errored or was denied/cancelled

The SDK ToolCallStatus (confirmed via ISS-055 in tool-call-bridge.ts) is `'pending' | 'in_progress' | 'completed' | 'failed'`.

A review that completes execution and produces a score is a successful tool execution regardless of whether the score meets a threshold. Using `'failed'` implies the tool errored, not that the review result was unfavorable.

### Verdict: CONFIRMED
A review that runs to completion and produces a score should report `'completed'` status. The pass/fail distinction is a business-logic outcome, not a tool execution status. The `_meta` fields already carry `_goodvibes/score` and `_goodvibes/passed` to distinguish the review outcome.

## Remediation
1. Always emit `'completed'` for reviews that finish execution, regardless of `passed` value
2. Continue using `_meta` fields (`_goodvibes/score`, `_goodvibes/passed`) to convey the review outcome
3. Reserve `'failed'` for cases where the review tool itself throws an error during execution
