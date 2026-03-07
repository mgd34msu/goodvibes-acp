# ISS-125 — RecordedEvent Does Not Capture _meta from Source Events

**Severity**: Minor
**File**: `src/extensions/acp/event-recorder.ts:52-57`
**KB Topic**: Extensibility

## Original Issue
`RecordedEvent` does not capture `_meta` from source events — any `_meta` is lost on recording. Add optional `_meta` field. *(Extensibility)*

## Verification

### Source Code Check
The `RecordedEvent` type (lines 13-18):
```typescript
export type RecordedEvent = {
  type: string;
  timestamp: number;
  sessionId?: string;
  data: unknown;
};
```

The recording callback (lines 51-57):
```typescript
const entry: RecordedEvent = {
  type: event.type,
  timestamp: event.timestamp,
  ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
  data: event.payload,
};
```

No `_meta` field exists on `RecordedEvent`. If the source `event` has `_meta` (e.g., `_goodvibes/phase`, `traceparent`), it is not captured in `data: event.payload` (which is the event payload, not event-level metadata) and is permanently lost when the event is recorded.

### ACP Spec Check
KB-08 states `_meta` is available on notification params and is used for trace context propagation. The `EventRecorder` feeds the `_goodvibes/events` extension method response — clients inspecting the event log would lose `_meta` context (e.g., trace IDs) that was present on the original events. This makes distributed trace reconstruction from the event log impossible.

While ACP does not mandate event recording systems, the GoodVibes `_goodvibes/events` extension is part of the defined capability set (KB-08). Losing `_meta` from recorded events degrades the utility of that extension method for debugging and trace correlation.

### Verdict: CONFIRMED
The issue is confirmed. `RecordedEvent` lacks a `_meta` field and the recording logic does not capture it. For `_goodvibes/events` to be useful for distributed tracing and debugging, `_meta` context must be preserved. The omission is accurately described.

## Remediation
1. Add `_meta` to `RecordedEvent`:
   ```typescript
   export type RecordedEvent = {
     type: string;
     timestamp: number;
     sessionId?: string;
     data: unknown;
     _meta?: Record<string, unknown>;
   };
   ```
2. Update the recording callback to capture `_meta` from the source event:
   ```typescript
   const entry: RecordedEvent = {
     type: event.type,
     timestamp: event.timestamp,
     ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
     data: event.payload,
     ...('_meta' in event && event._meta ? { _meta: event._meta as Record<string, unknown> } : {}),
   };
   ```
3. Update the `EventBus` event type definition to include an optional `_meta` field if it does not already have one.
