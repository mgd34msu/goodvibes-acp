# ISS-059: track() doesn't emit _goodvibes/events on budget threshold crossings

**Severity**: Major
**File**: src/plugins/analytics/engine.ts
**Line(s)**: 80-100
**Topic**: Extensibility

## Issue Description
`track()` doesn't emit `_goodvibes/events` notifications on budget threshold crossings. Warnings are only returned when polled via `getWarnings()`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/08-extensibility.md (line 195)
- **Spec Says**: `_goodvibes/events` is a notification (agent -> client) for "Event bus notifications (triggers fired, hooks)". Budget threshold crossings are significant events that should be pushed proactively.
- **Confirmed**: Yes
- **Notes**: The KB defines `_goodvibes/events` as a push notification for event bus activity. Budget warnings (e.g., 80% threshold, over-budget) are exactly the kind of event that should trigger a notification to the client.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `engine.ts:80-100` shows `track()` records token usage, updates tool breakdown, and calls `this._budget.track(entry, sessionId)`. No EventBus emission, no notification triggering. The `getWarnings()` method at line 122-124 returns warnings only when called (polling). There is no EventBus dependency injected into `AnalyticsEngine` — no `_bus` or `eventBus` property.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Inject `EventBus` into `AnalyticsEngine` constructor
2. After `this._budget.track(entry, sessionId)`, check if any threshold was crossed
3. If threshold crossed, emit an event: `this._bus.emit('analytics:budget-warning', { sessionId, used, budget, percentage })`
4. Wire this event to `conn.extNotification('_goodvibes/events', ...)` in the agent layer
