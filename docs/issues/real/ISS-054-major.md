# ISS-054 — `toAcpExtensionEvent` output missing `sessionId` field

**Severity**: Major
**File**: `src/extensions/external/normalizer.ts`
**KB Topic**: KB-08: Extension Notifications

## Original Issue
The `toAcpExtensionEvent()` function converts a `NormalizedEvent` into ACP extension event params, but the output lacks a `sessionId` field. All `_goodvibes/*` notification params require `sessionId`.

## Verification

### Source Code Check
At lines 180-191, `toAcpExtensionEvent` returns:
```typescript
return {
  source: event.source,
  type: event.type,
  payload: event.payload,
  timestamp: event.timestamp,
  eventId: event.id,
};
```
No `sessionId` field is included in the returned object.

### ACP Spec Check
KB-08 shows all `_goodvibes/*` notifications include `sessionId` in their params. For example:
```json
{
  "jsonrpc": "2.0",
  "method": "_goodvibes/status",
  "params": {
    "sessionId": "sess_abc123def456",
    "phase": "applying",
    ...
  }
}
```
The TypeScript examples in KB-08 also show `sessionId: session.id` in all extension notification calls.

### Verdict: CONFIRMED
The `toAcpExtensionEvent` function omits `sessionId` from its output. KB-08 consistently shows `sessionId` as a required field in all `_goodvibes/*` notification params. Any consumer calling `session.sendNotification('_goodvibes/events', toAcpExtensionEvent(event))` would send a notification missing the required `sessionId`.

## Remediation
1. Add `sessionId: string` as a required parameter to `toAcpExtensionEvent`.
2. Include `sessionId` in the returned object.
3. Update all call sites to pass the session ID.
