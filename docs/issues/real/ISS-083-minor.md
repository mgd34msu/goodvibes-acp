# ISS-083: IPC id typed as string only -- JSON-RPC 2.0 allows number | string | null

**Source**: `src/extensions/ipc/protocol.ts` line 37  
**KB Reference**: KB-01 (JSON-RPC 2.0)  
**Severity**: Minor

## Description

The `IpcMessage` interface types `id` as `string` only. JSON-RPC 2.0 specifies that the `id` field can be a string, number, or null. Restricting to `string` means the IPC layer would reject or incorrectly handle valid JSON-RPC 2.0 messages with numeric IDs.

## Evidence

`IpcMessage` (`src/extensions/ipc/protocol.ts:37`):
```typescript
export interface IpcMessage {
  jsonrpc: '2.0';
  type: string;
  id: string;  // Should be string | number
  _meta?: { timestamp?: number };
}
```

Note: `IpcResponse` already correctly types `id: string | null` (line 57), showing inconsistency within the same file.

KB-01 states: "IDs are correlation keys" and shows examples with numeric IDs (`"id": 1`).

### Verdict: CONFIRMED

The `IpcMessage.id` type is overly restrictive compared to JSON-RPC 2.0 spec. The `IpcResponse` in the same file already handles `string | null`, further confirming this is an oversight.

## Remediation

1. Change `IpcMessage.id` from `string` to `string | number`.
2. Update any downstream code that assumes `id` is always a string (e.g., Map keys, comparisons).
3. Ensure serialization/deserialization handles numeric IDs correctly.
