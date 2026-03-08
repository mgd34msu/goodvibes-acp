# Wave 1 Agent 8: IPC Layer

**ACP Compliance Score**: 7/10
**Issues Found**: 8 (1C, 3M, 2m, 2N)

## Scope

Reviewed `src/extensions/ipc/protocol.ts`, `src/extensions/ipc/router.ts`, `src/extensions/ipc/socket.ts`, `src/extensions/ipc/index.ts` against ACP knowledgebase (KB-01 Transport, KB-08 Extensibility).

**Note**: The IPC layer is an internal inter-process protocol (daemon-to-daemon), not the primary ACP transport. It explicitly documents that ACP methods are handled by `AgentSideConnection`, not the IPC router. Issues below relate to protocol correctness and alignment with the JSON-RPC 2.0 conventions the IPC layer claims to follow.

## Issues

### 1. IpcNotification uses `event` instead of `method` — violates JSON-RPC 2.0 (KB-01: JSON-RPC 2.0)
**Severity**: Critical
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 64-71
**Description**: The module header states "Follows JSON-RPC 2.0 conventions" but `IpcNotification` uses an `event` field instead of `method`. JSON-RPC 2.0 Section 4.1 specifies that notifications MUST have a `method` field (a String). The `event` field is non-standard and would be rejected by any JSON-RPC 2.0 compliant parser. The `deserializeMessage` function (line 116) validates `event` instead of `method` for notifications, compounding the deviation.

**Remediation**: Rename `event` to `method` on `IpcNotification`, or drop the JSON-RPC 2.0 compliance claim and document this as a custom wire protocol. If renaming, update `buildNotification` and `deserializeMessage` accordingly.

### 2. Non-standard `type` discriminator field on all message types (KB-01: JSON-RPC 2.0)
**Severity**: Major
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 34-35, 44, 55, 66
**Description**: All IPC message interfaces include a `type` field (`'request'`, `'response'`, `'notification'`) used as a discriminant. Standard JSON-RPC 2.0 distinguishes message types by structural properties: requests have `method` + `id`, notifications have `method` without `id`, responses have `result` or `error` + `id`. Adding a `type` field is a protocol extension. The `deserializeMessage` function (line 100) requires `type` as a mandatory field, meaning it rejects valid JSON-RPC 2.0 messages that lack it.

**Remediation**: Either (a) remove the `type` field and discriminate structurally (presence of `method`/`id`/`result`/`error`), or (b) document this as an intentional IPC-specific extension and stop claiming JSON-RPC 2.0 compliance in the module header.

### 3. IpcResponse does not extend IpcMessage — inconsistent type hierarchy (KB-09: TypeScript patterns)
**Severity**: Major
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 52-62
**Description**: `IpcRequest` and `IpcNotification` extend `IpcMessage`, but `IpcResponse` is a standalone interface that duplicates `jsonrpc: '2.0'` and `type` fields. This means `IpcResponse` does not carry `_meta`, breaking the extensibility pattern described in KB-08 (every protocol type should support `_meta`). The `serializeMessage` function signature (line 81) accepts `IpcMessage | IpcResponse | IpcNotification` as a union — the `IpcResponse` arm is necessary only because it doesn't extend `IpcMessage`.

**Remediation**: Have `IpcResponse` extend `IpcMessage` (with `id` as `string | null`) or create a shared base interface. Ensure `_meta` is available on responses.

### 4. No buffer size limit on socket connections — unbounded memory growth (KB-10: Implementation)
**Severity**: Major
**File**: `src/extensions/ipc/socket.ts`
**Lines**: 186-198
**Description**: `_handleData` appends incoming chunks to `state.buffer` without any size limit. A malicious or buggy client can send data without newlines, growing the buffer indefinitely until the process runs out of memory. This is a denial-of-service vector on the Unix domain socket.

**Remediation**: Add a maximum buffer size constant (e.g., 1MB). When the buffer exceeds the limit, emit an error event, send a parse error response, and destroy the socket.

### 5. `_meta` lacks W3C trace context reserved key documentation (KB-08: Extensibility)
**Severity**: Minor
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 38-39
**Description**: KB-08 specifies that `traceparent`, `tracestate`, and `baggage` are reserved `_meta` keys for W3C Trace Context. The `_meta` type on `IpcMessage` is `Record<string, unknown> & { timestamp?: number }` — the `timestamp` key is documented but the W3C reserved keys are not. While the open `Record<string, unknown>` allows them, the JSDoc comment ("e.g. timestamp, W3C trace context") should reference the specific reserved keys for discoverability.

**Remediation**: Add typed optional fields for `traceparent`, `tracestate`, and `baggage` to the `_meta` intersection type, or add a JSDoc `@see` reference to KB-08.

### 6. deserializeMessage return type is IpcMessage but callers need to narrow (KB-09: TypeScript)
**Severity**: Minor
**File**: `src/extensions/ipc/socket.ts`
**Lines**: 201-224
**Description**: `deserializeMessage` returns `IpcMessage` but notifications (`IpcNotification`) extend `Omit<IpcMessage, 'id'>` — they lack `id`. The return type is technically incorrect for notification messages. In `socket.ts` line 220-224, the server checks `message.type !== 'request'` and casts to `IpcRequest` on line 224. This works at runtime but the type flow is unsound: `message` typed as `IpcMessage` claims to have `id: string`, but a notification won't.

**Remediation**: Change `deserializeMessage` to return a discriminated union type: `IpcRequest | IpcResponse | IpcNotification`, or a more general `IpcMessage | IpcNotification` union.

### 7. No handling of response messages received by server (KB-01: JSON-RPC 2.0)
**Severity**: Note
**File**: `src/extensions/ipc/socket.ts`
**Lines**: 219-222
**Description**: The socket server only routes `request` type messages and silently drops everything else (notifications and responses). If a client sends a `type: 'response'` message (e.g., answering a server-initiated request in a bidirectional scenario), it is silently ignored with no logging. This is acceptable for the current unidirectional model but will need revisiting if the IPC layer ever supports server-to-client requests.

**Remediation**: Add a debug-level log or event emission for unhandled message types so they are observable during development.

### 8. Router `status` handler exposes raw `process.memoryUsage()` (KB-10: Implementation)
**Severity**: Note
**File**: `src/extensions/ipc/router.ts`
**Lines**: 112-117
**Description**: The built-in `status` handler returns `process.memoryUsage()` and `process.pid` directly. While this is internal IPC, exposing raw memory metrics and PID without any access control creates information leakage if the socket path is predictable. The optional chaining on `this._eventBus?.handlerCount` (line 116) also suggests the eventBus could be null, but the constructor requires it.

**Remediation**: Consider gating status details behind a configuration flag or auth token. The optional chaining on `_eventBus` is unnecessary given the constructor signature and could be removed for clarity.

## Summary

The IPC layer is well-structured for its purpose as an internal daemon communication channel. The primary compliance gap is that it claims JSON-RPC 2.0 compliance in its module header but deviates in multiple ways: the `type` discriminator field, `event` instead of `method` on notifications, and inconsistent type hierarchy. These are not ACP transport issues (the ACP transport is handled by `AgentSideConnection`), but they create confusion about what protocol the IPC layer actually implements.

The most actionable fix is Issue 1 (rename `event` to `method`) which aligns the notification format with JSON-RPC 2.0. Issue 4 (buffer limits) is the most important for production safety.

**Recommendation**: Either align fully with JSON-RPC 2.0 or rebrand the module header to say "JSON-RPC 2.0-inspired wire protocol" to set correct expectations.
