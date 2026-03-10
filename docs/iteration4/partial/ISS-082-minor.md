# ISS-082 — `_meta` lacks W3C trace context reserved key documentation

**Severity**: Minor
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 38–39
**KB Reference**: KB-08 (Extensibility)

## Issue

The `IpcMessage._meta` type is defined as:

```typescript
_meta?: Record<string, unknown> & { timestamp?: number };
```

This types `timestamp` but does not document or type the W3C reserved keys (`traceparent`, `tracestate`, `baggage`) specified in KB-08 lines 48–56.

However, the `IpcMessage` type is an **internal IPC protocol** type, not an ACP wire format type. The ACP `_meta` contract applies to ACP protocol messages, not internal inter-process communication.

### Verdict: PARTIAL

The W3C reserved keys are defined by the ACP extensibility spec (KB-08) for ACP protocol types. While adding them to the IPC type would improve OpenTelemetry interop if traces propagate across IPC boundaries, this is an internal type and not strictly an ACP compliance issue.

## Remediation

1. Add optional typed fields for W3C trace context keys as JSDoc or interface members:
   ```typescript
   _meta?: Record<string, unknown> & {
     timestamp?: number;
     /** W3C Trace Context (KB-08) */
     traceparent?: string;
     tracestate?: string;
     baggage?: string;
   };
   ```
2. Alternatively, add a JSDoc `@see` reference to KB-08 reserved keys section.
