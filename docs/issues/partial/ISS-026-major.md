# ISS-026 — IPC Notification Interface Requires `id` — Must Not Have `id`

**Severity**: Major
**File**: src/extensions/ipc/protocol.ts:48-53
**KB Topic**: Notifications (01-overview.md lines 107-117)

## Original Issue
`IpcNotification` extends `IpcMessage` which requires an `id` field. ACP spec requires notifications to have no `id`. The absence of `id` is what distinguishes a notification from a request in JSON-RPC 2.0.

## Verification

### Source Code Check
Lines 48-53 of `protocol.ts`:
```typescript
export interface IpcNotification extends IpcMessage {
  type: 'notification';
  /** The event name (e.g. 'runtime:status-changed') */
  event: string;
}
```
`IpcNotification` extends `IpcMessage` which has `id: string` as a required field. This means every notification carries an `id`.

The `buildNotification` function (line 145-156) also requires an `id` parameter:
```typescript
export function buildNotification(
  id: string,
  event: string,
  payload: unknown = null,
): IpcNotification {
```

### ACP Spec Check
KB-01 (01-overview.md lines 107-117) states that notifications in JSON-RPC 2.0 must NOT have an `id` field. The absence of `id` is the semantic marker that distinguishes a notification (fire-and-forget) from a request (expects a response). From the spec wire example:
```json
{"jsonrpc":"2.0","method":"session/update","params":{...}}
```
Note: no `id` field.

However, this is the internal IPC protocol, not the ACP client-agent wire.

### Verdict: PARTIAL
The code does include `id` on notifications, which violates JSON-RPC 2.0 semantics. However, as with ISS-025, this is the internal IPC protocol for inter-process communication, not the ACP client-agent wire format. The ACP spec's JSON-RPC 2.0 requirements apply to client-agent communication. The issue correctly identifies a JSON-RPC 2.0 violation in the internal IPC design, but overstates it as an ACP compliance issue.

## Remediation
1. If adopting JSON-RPC 2.0 for internal IPC (per ISS-025), make `id` optional on the base message type
2. `IpcNotification` should explicitly omit `id`: `Omit<IpcMessage, 'id'>`
3. `buildNotification` should not accept an `id` parameter
4. Priority: Low — internal protocol design issue, not direct ACP wire violation
