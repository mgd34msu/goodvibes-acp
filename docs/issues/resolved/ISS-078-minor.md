# ISS-078 — IPC `IpcMessage` Includes Non-Standard Required `timestamp` Field

**Severity**: Minor
**File**: src/extensions/ipc/protocol.ts:26-27
**KB Topic**: Transport Layer (01-overview.md lines 35-64)

## Original Issue
`IpcMessage` includes a required `timestamp` field that does not exist in the ACP message structure.

## Verification

### Source Code Check
Lines 20-28 of `src/extensions/ipc/protocol.ts` confirm the issue:

```typescript
export interface IpcMessage {
  /** Discriminant — message category (e.g. 'request', 'response', 'notification') */
  type: string;
  /** Unique message identifier (monotonic counter or cuid) */
  id: string;
  /** Arbitrary message payload */
  payload: unknown;
  /** Unix timestamp (ms) when this message was created */
  timestamp: number;
}
```

The `timestamp` field is a required property on every `IpcMessage`. It is not optional.

### ACP Spec Check
KB-01 (01-overview.md lines 35-64) defines the transport layer and message structure. ACP messages over JSON-RPC 2.0 contain: `jsonrpc`, `id`, `method`, `params` (for requests), `result` (for success responses), `error` (for error responses), and optionally `_meta`. There is no `timestamp` field.

However, the IPC protocol in this codebase is an **internal** inter-process communication mechanism (Unix domain socket between daemon and CLI), not the ACP wire protocol itself. It is a custom protocol that happens to be inspired by JSON-RPC patterns.

### Verdict: PARTIAL
The `timestamp` field is indeed non-standard relative to JSON-RPC 2.0 and ACP message structure. However, the IPC protocol is an internal communication mechanism between the daemon and CLI — it is not the ACP wire format sent between client and agent. The issue correctly identifies the deviation, but the impact is reduced because this protocol is not exposed on the ACP wire. The concern about increased wire size and spec deviation is valid for internal consistency and if the IPC messages ever need to interoperate with ACP messages directly.

## Remediation
1. If the IPC protocol is intended to align with JSON-RPC 2.0/ACP conventions: remove `timestamp` as a required field, or make it optional in `_meta`
2. If `timestamp` serves a specific debugging or ordering purpose internally: document why it exists and consider making it optional
3. If refactoring IPC to use standard JSON-RPC 2.0 structure (addressing ISS-076 and ISS-077 simultaneously): move any metadata like `timestamp` into an optional `_meta` object
