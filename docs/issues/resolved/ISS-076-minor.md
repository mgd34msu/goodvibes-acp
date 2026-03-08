# ISS-076 — IPC Response Uses Non-Standard `correlationId` Field

**Severity**: Minor
**File**: src/extensions/ipc/protocol.ts:40-41
**KB Topic**: Request/Response Correlation (01-overview.md lines 71-105)

## Original Issue
`IpcResponse` uses a `correlationId` field instead of reusing the request `id` as JSON-RPC 2.0 requires.

## Verification

### Source Code Check
Lines 38-45 of `src/extensions/ipc/protocol.ts` confirm the issue:

```typescript
export interface IpcResponse extends IpcMessage {
  type: 'response';
  /** ID of the IpcRequest this response answers */
  correlationId: string;
  /** true if the operation succeeded */
  ok: boolean;
  /** Error message if ok === false */
  error?: string;
}
```

The `IpcResponse` introduces a separate `correlationId` field to link back to the request, rather than reusing the request's `id` in the response's `id` field as JSON-RPC 2.0 specifies.

### ACP Spec Check
KB-01 (01-overview.md lines 71-105) shows standard JSON-RPC 2.0 message structure:

**Request:**
```json
{ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { ... } }
```

**Response:**
```json
{ "jsonrpc": "2.0", "id": 1, "result": { ... } }
```

The response reuses the same `id` from the request. There is no `correlationId` field in JSON-RPC 2.0 or ACP. The `IpcMessage` base type already has an `id` field, and the response also generates a new `id` (via `_nextId()`), making the original request ID only recoverable through the non-standard `correlationId`.

### Verdict: CONFIRMED
The IPC protocol introduces a `correlationId` field that does not exist in JSON-RPC 2.0 or ACP. Standard behavior is to set the response `id` equal to the request `id`. The current design generates a new `id` for the response AND adds `correlationId`, which is redundant and non-standard. While this is an internal IPC protocol (not the ACP wire format), it deviates from the JSON-RPC 2.0 conventions that ACP is built on.

## Remediation
1. Remove the `correlationId` field from `IpcResponse`
2. Set the response `id` to match the request `id` as JSON-RPC 2.0 requires
3. Update `buildResponse()` and all callers to pass the request's `id` as the response `id`
4. Update `_processLine()` and other handlers that use `correlationId` for routing
