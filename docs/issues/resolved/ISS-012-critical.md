# ISS-012: IpcNotification uses `event` instead of `method` — violates JSON-RPC 2.0

**Severity**: Critical  
**File**: `src/extensions/ipc/protocol.ts`  
**Lines**: 64-71  
**KB Reference**: KB-01 (JSON-RPC 2.0)

## Description

The `IpcNotification` interface uses an `event` field instead of the JSON-RPC 2.0 required `method` field. The deserializer also validates for `event` on notifications (line 116), rejecting standard-compliant notifications.

## Evidence

```typescript
export interface IpcNotification extends Omit<IpcMessage, 'id'> {
  type: 'notification';
  event: string;    // Should be `method: string` per JSON-RPC 2.0
  params: unknown;
}
```

`buildNotification()` (line 168-177) also uses `event` parameter and field. The `deserializeMessage()` function (line 116) validates `typeof rec.event !== 'string'` for notifications, meaning any standard JSON-RPC 2.0 notification with `method` would be rejected.

JSON-RPC 2.0 spec requires notifications to use `method` (same as requests, but without `id`).

### Verdict: CONFIRMED

The `event` field directly violates JSON-RPC 2.0 which requires `method` on all messages (requests and notifications). The deserializer also rejects compliant messages.

## Remediation

1. Rename `event` to `method` in `IpcNotification` interface.
2. Update `buildNotification()` parameter and field to use `method`.
3. Update `deserializeMessage()` validation (line 116) to check `rec.method` for notifications.
4. Update all callers of `buildNotification()` accordingly.
5. Alternatively, drop the JSON-RPC 2.0 compliance claim from the module documentation.
