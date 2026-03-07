# ISS-018: IPC protocol uses custom message format, not JSON-RPC 2.0

**Severity**: Critical
**File**: src/extensions/ipc/protocol.ts
**Line(s)**: 19-53
**Topic**: TypeScript SDK

## Issue Description
IPC protocol uses custom message format, not JSON-RPC 2.0. Uses `type` instead of `jsonrpc: "2.0"`, `correlationId` instead of `id`, `ok: boolean` instead of `result/error` objects.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/09-typescript-sdk.md (core architecture) and docs/acp-knowledgebase/01-overview.md (transport)
- **Spec Says**: ACP is built on JSON-RPC 2.0. All messages must include `jsonrpc: "2.0"`. Requests have `id` (number), `method` (string), `params`. Responses have `id` (matching request), and either `result` or `error: { code, message, data? }`. Notifications have `method` and `params` but no `id`.
- **Confirmed**: Yes
- **Notes**: The IPC module is explicitly described as internal inter-process communication, not external ACP communication. However, if it's intended to carry ACP messages between runtime components, it should use JSON-RPC 2.0. If it's purely internal tooling, the non-conformance is less critical but still a design concern.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `IpcMessage` (lines 19-28) uses `type: string` (not `jsonrpc`), `id: string` (not number), `payload: unknown` (not `params`), `timestamp: number` (not in JSON-RPC). `IpcResponse` (lines 38-46) uses `correlationId` (not `id` matching request), `ok: boolean` (not `result/error`), `error?: string` (not structured error object). `IpcNotification` (lines 49-53) uses `event: string` (not `method`). None of these conform to JSON-RPC 2.0.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
The IPC protocol is entirely custom and shares no structure with JSON-RPC 2.0. This creates a translation barrier if IPC messages need to carry ACP protocol data. Any component receiving IPC messages cannot interpret them as ACP messages without a full translation layer.

## Remediation Steps
1. Redefine `IpcMessage` to include `jsonrpc: '2.0'` discriminator
2. Change `id` to `number | string` per JSON-RPC 2.0 spec
3. Replace `correlationId` with matching `id` from the request
4. Replace `ok: boolean` + `error?: string` with proper `result` / `error: { code, message, data? }` structure
5. Replace `type: 'notification'` + `event` with standard JSON-RPC notification (method + params, no id)
6. Alternatively, if IPC is intentionally non-ACP, document it clearly and ensure no ACP messages flow through it
