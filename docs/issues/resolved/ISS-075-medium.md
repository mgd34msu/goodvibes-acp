# ISS-075 — Review not-passed maps to `'failed'` tool call status
**Severity**: Medium
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**KB Topic**: KB-06: Tool Calls

## Original Issue
A below-threshold review score is semantically `'completed'` (the tool ran successfully), not `'failed'` (tool errored). Misleads ACP clients.

## Verification

### Source Code Check
`src/extensions/wrfc/wrfc-event-bridge.ts` line 199:
```
const status: acp.ToolCallStatus = p.passed ? 'completed' : 'failed';
```
When a review completes but the score is below threshold, the code reports `'failed'` as the tool call status.

### ACP Spec Check
KB-06 defines `ToolCallStatus` values:
- `completed`: Tool finished successfully
- `failed`: Tool errored or was denied/cancelled

A review that runs to completion and produces a score has not errored — it completed successfully. The pass/fail of the review is the *result*, not an indication of tool execution failure. Using `'failed'` status misrepresents the tool's execution state to ACP clients.

Note: KB-04 shows SDK ToolCallStatus as `"pending" | "in_progress" | "completed" | "cancelled" | "error"`, while KB-06 uses `"failed"`. Per known context, SDK is authoritative. Either way, a below-threshold review is semantically `'completed'` — the tool ran, it just returned an unfavorable result.

### Verdict: CONFIRMED
The code incorrectly maps a below-threshold review score to `'failed'`/`'error'` tool call status. The review tool executed successfully — the score result should be communicated via content and `_meta`, not via the status field.

## Remediation
1. Always use `'completed'` status for reviews that ran to completion, regardless of pass/fail result.
2. Encode the pass/fail outcome in the tool call content text and `_meta` fields (which the code already does via `'_goodvibes/passed'` and `'_goodvibes/score'`).
3. Clients can inspect `_meta` to determine review pass/fail without misinterpreting tool execution status.
