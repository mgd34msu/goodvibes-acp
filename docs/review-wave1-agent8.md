# Wave 1 Review — Agent 8: IPC (Inter-Process Communication)

**Reviewer**: goodvibes:reviewer  
**Scope**: `src/extensions/ipc/` (index.ts, protocol.ts, router.ts, socket.ts)  
**KB References**: 01-overview.md, 09-typescript-sdk.md  
**ACP Spec**: https://agentclientprotocol.com/llms-full.txt  
**Score**: 6.8/10  
**Issues**: 2 major, 5 minor, 2 nitpick  

---

## Reality Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Files exist | PASS | All 4 files found on disk |
| Exports used | PASS | Barrel exports consumed by other modules |
| Import chain valid | PASS | Connected via index.ts barrel |
| No placeholders | PASS | No TODO/FIXME/stub implementations |
| Integration verified | PASS | Router and socket server are wired together |

---

## Critical Issues

None.

---

## Major Issues

| # | Location | Issue | Category |
|---|----------|-------|----------|
| 1 | `src/extensions/ipc/protocol.ts:34-35` | Non-standard `type` discriminant field breaks JSON-RPC 2.0 compliance | Correctness |
| 2 | `src/extensions/ipc/socket.ts:187` | Unbounded buffer accumulation — no size limit on `state.buffer` | Security |

### 1. Non-standard `type` discriminant field in IpcMessage (protocol.ts:34-35)

**Severity**: Major (Correctness)  
**KB Reference**: 01-overview.md lines 67-117 — JSON-RPC 2.0 Message Types

The `IpcMessage` base interface includes a `type: string` discriminant field (`'request'`, `'response'`, `'notification'`). Standard JSON-RPC 2.0 does not define a `type` field. Messages are discriminated structurally:

- **Request**: has `method` and `id`
- **Response**: has `result` or `error`, plus `id`
- **Notification**: has `method`, no `id`

The module header claims "Follows JSON-RPC 2.0 conventions" (line 10), but the `type` field is a custom extension. The `deserializeMessage` function (line 100) validates `type` as required, meaning it would reject valid JSON-RPC 2.0 messages from any standard-compliant sender.

**Impact**: Any external system sending standard JSON-RPC 2.0 messages will fail deserialization. While the router.ts docs clarify this is for internal IPC (not ACP), the protocol module's claim of JSON-RPC 2.0 compliance is misleading.

**Fix**: Either (a) remove `type` and use structural discrimination per the JSON-RPC 2.0 spec, or (b) update documentation to explicitly state this is a JSON-RPC 2.0 *superset* with a custom `type` field for internal use only.

### 2. Unbounded buffer accumulation (socket.ts:187)

**Severity**: Major (Security)  
**KB Reference**: N/A — general security concern

The `_handleData` method appends incoming chunks to `state.buffer` without any size limit:

```typescript
state.buffer += chunk;  // line 187 — no cap
```

A malicious or malfunctioning client can send continuous data without newlines, growing the buffer indefinitely until the process runs out of memory.

**Fix**: Add a maximum buffer size constant (e.g., 1MB) and destroy the connection if exceeded:

```typescript
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB
if (state.buffer.length > MAX_BUFFER_SIZE) {
  socket.destroy(new Error('IPC message buffer exceeded maximum size'));
  return;
}
```

---

## Minor Issues

| # | Location | Issue | Category |
|---|----------|-------|----------|
| 3 | `src/extensions/ipc/protocol.ts:37,57` | `id` typed as `string` only — JSON-RPC 2.0 allows `number \| string \| null` | Correctness |
| 4 | `src/extensions/ipc/protocol.ts:65-71` | IpcNotification uses `event` instead of `method` — diverges from JSON-RPC 2.0 | Correctness |
| 5 | `src/extensions/ipc/protocol.ts:126-138` | `buildRequest` does not validate empty/blank method names | Error Handling |
| 6 | `src/extensions/ipc/socket.ts:226-239` | `.then()` success handler can throw without being caught | Error Handling |
| 7 | `src/extensions/ipc/protocol.ts:81` | `serializeMessage` performs no runtime validation before serializing | Error Handling |

### 3. `id` restricted to `string` only (protocol.ts:37, 57)

**Severity**: Minor  
**KB Reference**: 01-overview.md line 79 — example shows `"id": 1` (number)

JSON-RPC 2.0 spec states `id` can be a string, number, or null. The ACP KB examples use numeric IDs (`"id": 1`). `IpcMessage.id` is typed `string` and `IpcResponse.id` is `string | null`, excluding numeric IDs entirely.

**Fix**: Change to `id: string | number` on IpcMessage and `id: string | number | null` on IpcResponse.

### 4. IpcNotification uses `event` instead of `method` (protocol.ts:65-71)

**Severity**: Minor  
**KB Reference**: 01-overview.md lines 107-117 — Notification format

JSON-RPC 2.0 notifications use a `method` field (see KB line 112: `"method": "session/cancel"`). The IpcNotification interface uses `event` instead. This means IPC notifications cannot be processed by any standard JSON-RPC 2.0 handler.

**Fix**: Rename `event` to `method` to align with JSON-RPC 2.0, or add `method` as an alias and keep `event` for backward compatibility.

### 5. No validation on empty method names (protocol.ts:126-138)

**Severity**: Minor  
**KB Reference**: N/A — defensive coding

`buildRequest` accepts any string for `method`, including empty strings. An empty method would produce a syntactically valid but semantically broken request that the router would silently fail to match.

**Fix**: Add a guard: `if (!method) throw new Error('IPC request method must be a non-empty string');`

### 6. Potential unhandled error in `.then()` success path (socket.ts:226-239)

**Severity**: Minor  
**KB Reference**: N/A — error handling

The `.then()` pattern has a rejection handler, but if `_sendResponse` (called on line 228) throws synchronously (e.g., socket already destroyed between the check and write), that error propagates as an unhandled promise rejection.

**Fix**: Wrap the success callback in try/catch, or use async/await with a surrounding try/catch block.

### 7. `serializeMessage` has no runtime validation (protocol.ts:81)

**Severity**: Minor  
**KB Reference**: N/A — defensive coding

The function accepts a union type but trusts the caller entirely. Passing a malformed object (missing `jsonrpc`, missing `type`) produces invalid wire messages with no error.

**Fix**: Add a minimal runtime check (e.g., assert `jsonrpc === '2.0'`) or document that callers must use `build*` functions.

---

## Nitpick Issues

| # | Location | Issue | Category |
|---|----------|-------|----------|
| 8 | `src/extensions/ipc/protocol.ts:39` | `_meta` only supports `timestamp` — ACP spec supports richer metadata | Documentation |
| 9 | `src/extensions/ipc/router.ts:116` | `handlerCount` accessed on EventBus may not exist | Correctness |

### 8. Limited `_meta` shape (protocol.ts:39)

**Severity**: Nitpick  
**KB Reference**: 01-overview.md lines 374-390 — `_meta` field

The ACP spec defines `_meta` as accepting arbitrary keys plus reserved W3C trace context keys (`traceparent`, `tracestate`, `baggage`). The IPC `_meta` type is narrowed to `{ timestamp?: number }` only, preventing trace context propagation.

**Fix**: Widen to `Record<string, unknown> & { timestamp?: number }` or use an index signature.

### 9. `handlerCount` property assumption (router.ts:116)

**Severity**: Nitpick  

The `status` built-in handler accesses `this._eventBus.handlerCount`. If the EventBus class does not expose this property (or renames it), this will fail at runtime with no compile-time safety net unless the EventBus type includes it.

**Fix**: Verify `handlerCount` exists on the EventBus interface, or use optional chaining.

---

## Category Breakdown

| Category | Score | Key Issues |
|----------|-------|------------|
| Security | 7/10 | Unbounded buffer (issue #2) |
| Error Handling | 7/10 | No method validation, unhandled throw path, no serialization checks |
| Correctness | 6/10 | Non-standard `type` field, `string`-only IDs, `event` vs `method` |
| Organization | 9/10 | Clean separation: protocol, router, socket, barrel |
| Documentation | 8/10 | Good module-level docs, clear scope boundaries |
| Performance | 9/10 | Efficient NDJSON parsing, async routing |
| SOLID/DRY | 9/10 | Single responsibility per module |
| Naming | 8/10 | Clear naming, though `event` vs `method` is confusing |
| Maintainability | 8/10 | Readable, low complexity |
| Dependencies | 9/10 | Minimal: only core EventBus and node:net/fs |

---

## Recommendations

1. **Immediate**: Add buffer size limits to `socket.ts` to prevent memory exhaustion
2. **This PR**: Document that the `type` field is a non-standard extension, or refactor to use structural JSON-RPC 2.0 discrimination
3. **Follow-up**: Align `id` types with JSON-RPC 2.0 spec (`string | number`), rename `event` to `method` on notifications
