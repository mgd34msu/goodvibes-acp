# ISS-027 — IPC Error Response Uses `ok: boolean` Instead of JSON-RPC 2.0 Error Object

**Severity**: Major
**File**: src/extensions/ipc/protocol.ts:38-46
**KB Topic**: JSON-RPC 2.0 Error Response (01-overview.md lines 96-105)

## Original Issue
`IpcResponse` uses `ok: boolean` and `error?: string` for error signaling instead of the JSON-RPC 2.0 structured error object `{ code: number, message: string, data?: unknown }`. The `ok` boolean pattern and flat `error` string lose structured error information.

## Verification

### Source Code Check
Lines 38-46 of `protocol.ts`:
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
The response uses `ok: boolean` for success/failure indication and `error?: string` for error messages. This lacks the structured error format with numeric error codes.

### ACP Spec Check
KB-01 (01-overview.md lines 96-105) defines JSON-RPC 2.0 error responses:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": { "method": "session/unknown" }
  }
}
```
Standard error codes include -32700 (Parse error), -32600 (Invalid request), -32601 (Method not found), -32602 (Invalid params), -32603 (Internal error). The `error` field must be an object, not a flat string.

Again, this applies to the ACP client-agent wire, not internal IPC.

### Verdict: PARTIAL
The code uses a non-standard error format that loses structured error information (error codes, data). This is a valid design concern. However, as with ISS-025 and ISS-026, this is the internal IPC protocol, not the ACP client-agent wire. The ACP spec's JSON-RPC 2.0 error format requirements apply to client-agent communication. The issue correctly identifies a JSON-RPC 2.0 deviation but overstates the ACP compliance impact.

## Remediation
1. If adopting JSON-RPC 2.0 for internal IPC (per ISS-025), replace `ok: boolean` + `error?: string` with a proper error object
2. Use `result?: unknown` for success and `error?: { code: number; message: string; data?: unknown }` for failure
3. Define standard error codes for internal IPC operations
4. Priority: Low — internal protocol design issue, not direct ACP wire violation
