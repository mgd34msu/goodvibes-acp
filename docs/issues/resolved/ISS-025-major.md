# ISS-025 — IPC Protocol Uses Non-JSON-RPC 2.0 Wire Format

**Severity**: Major
**File**: src/extensions/ipc/protocol.ts:19-28
**KB Topic**: JSON-RPC 2.0 Message Types (01-overview.md lines 67-117)

## Original Issue
`IpcMessage` uses a custom wire format (`type`, `id`, `payload`, `timestamp`) instead of JSON-RPC 2.0 (`jsonrpc`, `id`, `method`, `params`). The custom fields are non-standard and prevent future ACP proxying without a full translation layer.

## Verification

### Source Code Check
Lines 19-28 of `protocol.ts`:
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
This uses `type`, `payload`, `timestamp` instead of JSON-RPC 2.0's `jsonrpc`, `method`, `params`.

### ACP Spec Check
KB-01 (01-overview.md lines 67-117) mandates JSON-RPC 2.0 as the message envelope format:
```json
{"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {...}}
```
Requests must have `jsonrpc`, `id`, `method`, `params`. Responses must have `jsonrpc`, `id`, `result` (or `error`). Notifications must have `jsonrpc`, `method`, `params` (no `id`).

However, this IPC protocol is used for **internal inter-process communication** (Unix domain sockets between goodvibes processes), not for the ACP client-agent wire protocol. The ACP spec governs the client-agent transport, not internal IPC.

### Verdict: PARTIAL
The code does use a non-JSON-RPC 2.0 format, which is accurately described. However, the IPC protocol is internal infrastructure for inter-process communication between goodvibes daemon processes, not the ACP client-agent transport. The ACP spec does not directly govern internal IPC. The issue is valid from a design perspective (using JSON-RPC 2.0 internally would enable easier proxying and protocol consistency), but overstates the compliance violation since ACP only mandates JSON-RPC 2.0 for client-agent communication.

## Remediation
1. Consider adopting JSON-RPC 2.0 for internal IPC to maintain consistency and enable future ACP proxying
2. Replace `type` discriminator with `method` field
3. Replace `payload` with `params`
4. Add `jsonrpc: '2.0'` field
5. Remove `timestamp` (not part of JSON-RPC 2.0; use `_meta` if needed)
6. Priority: Low — this is internal infrastructure, not a direct ACP wire violation
