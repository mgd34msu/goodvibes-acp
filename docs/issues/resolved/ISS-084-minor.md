# ISS-084: IPC notifications use event instead of method (KB-01: JSON-RPC 2.0)

**Source**: `src/extensions/ipc/protocol.ts` lines 65-71  
**KB Reference**: KB-01 (JSON-RPC 2.0)  
**Severity**: Minor

## Description

The `IpcNotification` interface uses an `event` field instead of `method`. JSON-RPC 2.0 notifications use a `method` field. Since `IpcMessage` declares `jsonrpc: '2.0'`, the notification type should follow the JSON-RPC 2.0 convention.

## Evidence

`IpcNotification` (`src/extensions/ipc/protocol.ts:65-71`):
```typescript
export interface IpcNotification extends Omit<IpcMessage, 'id'> {
  type: 'notification';
  event: string;   // JSON-RPC 2.0 uses 'method'
  params: unknown;
}
```

KB-01 shows JSON-RPC 2.0 notifications use `method`:
```json
{"jsonrpc": "2.0", "method": "session/cancel", "params": { ... }}
```

### Verdict: PARTIAL

The IPC layer is an internal protocol, not the ACP wire protocol itself. While it declares `jsonrpc: '2.0'`, the `type` discriminant field already deviates from JSON-RPC 2.0 (which uses presence/absence of `id` and `method`/`error`/`result` to discriminate). Using `event` instead of `method` is another deviation, but since this is internal IPC (not ACP transport), the impact is limited to code clarity and interoperability with standard JSON-RPC 2.0 libraries.

## Remediation

1. Rename `event` to `method` in `IpcNotification` for JSON-RPC 2.0 alignment.
2. Update all references to `notification.event` throughout the IPC codebase.
3. Alternatively, if the IPC layer intentionally deviates from JSON-RPC 2.0, remove the `jsonrpc: '2.0'` declaration to avoid confusion.
