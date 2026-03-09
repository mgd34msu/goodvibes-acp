# ISS-073 — `_meta` propagation lost in EventBus `_emitError`
**Severity**: Medium
**File**: `src/core/event-bus.ts`
**KB Topic**: KB-08: Extensibility

## Original Issue
Error events don't carry forward `_meta` from originating events, breaking W3C trace context propagation.

## Verification

### Source Code Check
`src/core/event-bus.ts` lines 334-352 show `_emitError` creates an `EventRecord` with:
```
const record: EventRecord = {
  id: this._nextId(),
  type: 'error',
  payload: errorPayload,
  timestamp: Date.now(),
};
```
No `_meta` field is propagated from the source event. The method signature is `_emitError(sourceType: string, err: unknown)` — it receives only the source type string, not the source event record, so `_meta` from the originating event is not available.

### ACP Spec Check
KB-08 states every ACP type should include optional `_meta`, and specifically reserves W3C trace context keys (`traceparent`, `tracestate`, `baggage`). If an error occurs during processing of a traced event, losing the trace context breaks distributed tracing.

### Verdict: CONFIRMED
The `_emitError` method does not propagate `_meta` from source events. The method signature doesn't even accept the source event record, only a string type name. This breaks W3C trace context propagation through error paths.

## Remediation
1. Modify `_emitError` signature to accept optional source `_meta`: `_emitError(sourceType: string, err: unknown, sourceMeta?: Record<string, unknown>)`.
2. Pass `_meta` through to the error `EventRecord`.
3. Update all callers to forward `_meta` from the originating event.
