# ISS-027 — Non-standard `type` discriminator on IPC message types

**Severity**: Major
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 34-35, 44, 55, 66
**KB Reference**: KB-01 (JSON-RPC 2.0)

## Description

All IPC message types include a non-standard `type` field as a discriminator:
- `IpcMessage`: `type: string` (line 35)
- `IpcRequest`: `type: 'request'` (line 44)
- `IpcResponse`: `type: 'response'` (line 55)
- `IpcNotification`: `type: 'notification'` (line 66)

Standard JSON-RPC 2.0 discriminates messages structurally: requests have `method` + `id`, responses have `result` or `error` + `id`, notifications have `method` but no `id`. Adding a `type` field is non-standard, and the deserializer at line 100 *requires* `type` to be present, rejecting valid JSON-RPC 2.0 messages that lack it.

### Verdict: PARTIAL

The IPC protocol is an internal communication channel (Unix domain sockets between processes), not the ACP wire protocol. While the module claims JSON-RPC 2.0 compliance (line 10: "Follows JSON-RPC 2.0 conventions"), the `type` field is a non-standard extension that breaks interoperability with standard JSON-RPC 2.0 parsers. This is a code quality / standards compliance issue rather than a direct ACP protocol violation, since IPC messages never cross the ACP wire.

## Remediation

1. Remove the `type` field from all IPC message types
2. Discriminate structurally in `deserializeMessage()`: presence of `method` + `id` = request, `method` without `id` = notification, `result` or `error` = response
3. Alternatively, keep the `type` field but drop the JSON-RPC 2.0 compliance claim and document it as a custom protocol
