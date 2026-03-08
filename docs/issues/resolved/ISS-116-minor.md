# ISS-116 — No `session/update` notification for budget threshold crossings

**Severity**: Minor
**File**: `src/plugins/analytics/engine.ts`
**KB Topic**: KB-04: Session Info Updates

## Original Issue
Budget threshold crossings (75%, 90%, 100%) store warnings but never emit `session/update` with `session_info`. Budget warnings are exactly the kind of status update `session_info` is designed for.

## Verification

### Source Code Check
At lines 115-151, the `track()` method detects three threshold crossings:
- Warning threshold (default 75%) — lines 128-135
- Alert threshold (default 90%) — lines 137-144
- Budget exhaustion (100%) — lines 146-150

When a threshold is crossed, the code stores warnings in `_pendingWarnings` via:
```typescript
this._pendingWarnings.set(sessionId, [...this.getWarnings(sessionId)]);
```
But `_pendingWarnings` is never consumed by any code that emits ACP `session/update` notifications. There is no `session_info`-type update emitted. The warnings sit in an internal map with no external notification path.

The engine has no reference to an `AgentSideConnection` or any notification callback, so it cannot emit ACP notifications.

### ACP Spec Check
KB-04 (lines 289-310) defines `session_info` as:
> General informational message from the Agent (status updates, warnings, non-message content).

Budget threshold crossings are precisely the kind of operational warning that `session_info` is designed for. The spec does not MANDATE budget notifications, but the implementation detects thresholds and then does nothing with them.

### Verdict: CONFIRMED
The code detects budget threshold crossings and stores warnings, but never emits them as ACP `session/update` notifications. The `_pendingWarnings` map is write-only — no code reads from it to emit `session_info` updates. This is a confirmed gap between the threshold detection logic and ACP notification emission.

## Remediation
1. Accept an optional notification callback in the `AnalyticsEngine` constructor: `onBudgetWarning?: (sessionId: string, warnings: string[]) => void`.
2. Invoke the callback when threshold crossings are detected in `track()`.
3. In `main.ts`, wire the callback to emit `session/update` with `sessionUpdate: 'session_info'` and appropriate content.
4. Alternatively, accept an `EventBus` reference and emit a typed event that the ACP layer subscribes to.
