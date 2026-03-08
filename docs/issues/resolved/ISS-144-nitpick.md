# ISS-144 — IPC `_meta` only supports `timestamp`, should allow trace context

**Severity**: nitpick
**File**: `src/extensions/ipc/protocol.ts`
**Line**: 39
**KB Reference**: KB-01 (_meta Field), KB-08 (Extensibility)

## Issue Description

The IPC `_meta` type is narrowed to `{ timestamp?: number }`, preventing W3C trace context propagation (`traceparent`, `tracestate`, `baggage`) that KB-08 specifies all `_meta` fields should support.

## Source Evidence

- `src/extensions/ipc/protocol.ts` line 39: `_meta?: { timestamp?: number };`
- KB-08 defines `_meta` as `type Meta = { [key: string]: unknown }` and states it is available on all protocol types
- KB-01 lists reserved `_meta` keys: `traceparent`, `tracestate`, `baggage`

### Verdict: CONFIRMED

The IPC `_meta` type is overly narrow compared to the ACP extensibility contract. While IPC is an internal protocol (not ACP wire), following the same `_meta` convention enables consistent trace context propagation.

## Remediation

1. Widen the type to: `_meta?: Record<string, unknown> & { timestamp?: number }`
2. This preserves the `timestamp` convenience while allowing trace context and arbitrary extension data
