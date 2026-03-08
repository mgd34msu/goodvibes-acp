# ISS-032 — EventRecord Lacks _meta Field

**Severity**: Major
**File**: src/core/event-bus.ts:15
**KB Topic**: Extensibility — The `_meta` Field (08-extensibility.md lines 14-27)

## Original Issue
`EventRecord` lacks an optional `_meta: Record<string, unknown>` field. W3C trace context cannot be propagated through events.

## Verification

### Source Code Check
At `src/core/event-bus.ts:15-26`, the `EventRecord` interface is:
```typescript
export interface EventRecord<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly payload: TPayload;
  readonly timestamp: number;
  readonly sessionId?: string;
}
```
There is no `_meta` field.

### ACP Spec Check
KB-08 (Extensibility, lines 14-27) states: "Every type in the ACP protocol includes an optional `_meta` field." The `_meta` field is the designated location for W3C trace context (`traceparent`, `tracestate`, `baggage`) and vendor-specific metadata. Without it on the canonical event envelope, trace context cannot propagate through the event system.

### Verdict: CONFIRMED
The `EventRecord` interface is missing the `_meta` field. Since `EventRecord` is the canonical event envelope used across the entire system (event-bus, trigger-engine, etc.), this prevents trace context propagation and violates the ACP extensibility contract.

## Remediation
1. Add `_meta` to `EventRecord`:
   ```typescript
   export interface EventRecord<TPayload = unknown> {
     readonly id: string;
     readonly type: string;
     readonly payload: TPayload;
     readonly timestamp: number;
     readonly sessionId?: string;
     readonly _meta?: Record<string, unknown>;
   }
   ```
2. Update `emit()` to accept and forward `_meta` from callers.
3. Ensure `_meta` is preserved through the trigger engine and any event forwarding paths.
