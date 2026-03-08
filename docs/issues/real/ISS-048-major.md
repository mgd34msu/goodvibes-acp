# ISS-048 — `toAcpExtensionEvent` Embeds `method` Field in Params — JSON-RPC Envelope Violation

**Severity**: Major
**File**: src/extensions/external/normalizer.ts:180-191
**KB Topic**: Extension Methods (08-extensibility.md lines 152-156)

## Original Issue
`toAcpExtensionEvent` returns `{ method: '_goodvibes/events', ...params }`. The `method` field belongs in the JSON-RPC envelope, not in the params object.

## Verification

### Source Code Check
At lines 180-191:
```typescript
export function toAcpExtensionEvent(event: NormalizedEvent): Record<string, unknown> {
  return {
    method: '_goodvibes/events',
    params: {
      source: event.source,
      type: event.type,
      payload: event.payload,
      timestamp: event.timestamp,
      eventId: event.id,
    },
  };
}
```
The function returns an object containing both `method` and `params`. The docstring example (line 176) shows it being used as:
```typescript
const acpEnvelope = toAcpExtensionEvent(event);
session.sendNotification('_goodvibes/events', acpEnvelope);
```
This means `method` would appear both as the first argument to `sendNotification` AND nested inside the params object.

### ACP Spec Check
KB-08 (lines 152-155) shows the SDK pattern:
```typescript
await conn.extNotification('_goodvibes/status', {
  sessionId: session.id,
  phase: 'applying'
});
```
The `method` is the first argument to `extNotification`/`sendNotification`, and the second argument is the params object. The method should NOT appear inside the params.

### Verdict: CONFIRMED
The function embeds `method: '_goodvibes/events'` inside the returned object. When passed as the second argument to `sendNotification('_goodvibes/events', acpEnvelope)`, the resulting JSON-RPC message would have `method` specified twice: once in the envelope and once in the params. The returned object should contain only the params fields (`source`, `type`, `payload`, `timestamp`, `eventId`), not the `method`.

## Remediation
1. Remove the `method` field from the returned object — it should only contain the params:
```typescript
export function toAcpExtensionEvent(event: NormalizedEvent): Record<string, unknown> {
  return {
    source: event.source,
    type: event.type,
    payload: event.payload,
    timestamp: event.timestamp,
    eventId: event.id,
  };
}
```
2. Update the function's JSDoc to clarify it returns params, not a full envelope.
3. Alternatively, if the function is meant to return a full envelope, rename it and update callers to destructure `{ method, params }` before passing to `sendNotification`.
