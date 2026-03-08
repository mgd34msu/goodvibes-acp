# ISS-122 — Swallowed errors in WRFC bridge event handlers via `.catch(() => {})`

**Severity**: Minor
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 120, 128, 143, 150, 165, 172, 187, 203, 217
**KB Topic**: KB-10: Error Handling

## Original Issue
All `emitToolCall` and `emitToolCallUpdate` calls silently swallow errors with `.catch(() => {})`. No logging, no metrics, no fallback.

## Verification

### Source Code Check
Confirmed 9 instances of `.catch(() => {})` in wrfc-event-bridge.ts:
- Line 120: work phase `emitToolCall`
- Line 128: work phase `emitToolCallUpdate`
- Line 143: review phase `emitToolCall`
- Line 150: review phase `emitToolCallUpdate`
- Line 165: fix phase `emitToolCall`
- Line 172: fix phase `emitToolCallUpdate`
- Line 187: work-complete `emitToolCallUpdate`
- Line 203: review-complete `emitToolCallUpdate`
- Line 217: fix-complete `emitToolCallUpdate`

All swallow errors silently with no logging or diagnostics.

### ACP Spec Check
KB-10 covers error handling patterns for ACP implementations. While swallowing errors in UI notification paths (tool_call updates) may be intentional to avoid cascading failures, complete silence makes debugging impossible. At minimum, errors should be logged for operational visibility.

### Verdict: CONFIRMED
All 9 `.catch(() => {})` calls confirmed in source. Silent error swallowing prevents any observability into ACP session update failures.

## Remediation
1. Replace all `.catch(() => {})` with `.catch((err) => this._log?.warn('[WRFCEventBridge] emit failed', err))` or equivalent structured logging.
2. Alternatively, emit a diagnostic event on the internal event bus so monitoring can pick up failures without disrupting the WRFC flow.
3. Consider adding a failure counter metric for operational dashboards.
