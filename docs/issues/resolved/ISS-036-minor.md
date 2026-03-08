# ISS-036 — emit() has no _meta parameter blocking trace context propagation

**Severity**: Minor
**File**: `src/core/event-bus.ts`
**KB Topic**: KB-08: Extensibility

## Original Issue
The `emit()` method accepts `type`, `payload`, and `sessionId` but provides no way to pass `_meta` data. The `_meta` field exists on `EventRecord` but is never populated during emission. Without an emit-time path for `_meta`, distributed tracing across the ACP boundary is impossible.

## Verification

### Source Code Check
Line 167 of `event-bus.ts`:
```typescript
emit<TPayload = unknown>(type: string, payload: TPayload, sessionId?: string): void {
```
The method signature only accepts `type`, `payload`, and `sessionId`. The `EventRecord` type (line 27) includes `readonly _meta?: Record<string, unknown>`, but the `emit()` method constructs the record (lines 170-178) without setting `_meta`:
```typescript
const record: EventRecord<TPayload> = {
  id: this._nextId(),
  type,
  payload,
  timestamp: Date.now(),
  sessionId: sessionId ?? ((payload as Record<string, unknown>)?.sessionId as string | undefined),
};
```
No `_meta` field is ever populated.

### ACP Spec Check
KB-08 (Extensibility) defines `_meta` as the standard extension mechanism for attaching custom data to protocol types (lines 7-9). W3C trace context keys (`traceparent`, `tracestate`, `baggage`) are reserved in `_meta` (lines 48-53). Without an emit-time path for `_meta`, trace context from incoming ACP requests cannot be propagated through the internal event system.

### Verdict: CONFIRMED
The `_meta` field exists on `EventRecord` but there is no way to set it when emitting events. This prevents W3C trace context propagation through the internal event bus.

## Remediation
1. Add an optional `options` parameter to `emit()`: `emit<TPayload>(type: string, payload: TPayload, options?: { sessionId?: string; _meta?: Record<string, unknown> }): void`
2. Populate `record._meta` from the options when provided.
3. Alternatively, keep the current signature and add a separate `emitWithMeta()` method to avoid breaking existing callers.
