# ISS-077 — IPC Parse Error Response Uses `'unknown'` for `id` — Should Be `null`

**Severity**: Minor
**File**: src/extensions/ipc/socket.ts:205-213
**KB Topic**: JSON-RPC 2.0 Error Response (01-overview.md lines 96-105)

## Original Issue
Parse error responses use `correlationId: 'unknown'` as a fallback instead of the JSON-RPC 2.0-required `null`.

## Verification

### Source Code Check
Lines 203-213 of `src/extensions/ipc/socket.ts` confirm the issue:

```typescript
try {
  message = deserializeMessage(line);
} catch (err) {
  const errMsg = err instanceof Error ? err.message : String(err);
  const response: IpcResponse = buildResponse(
    this._nextId(),
    'unknown',
    false,
    null,
    `Parse error: ${errMsg}`,
  );
  this._sendResponse(socket, response);
  return;
}
```

The second argument to `buildResponse` is `'unknown'` — this is the `correlationId` value. When a message cannot be parsed, the original request ID is unavailable, and the code uses the string `'unknown'` as a fallback.

### ACP Spec Check
JSON-RPC 2.0 specification (referenced by KB-01, 01-overview.md lines 67-105) states that when the request `id` cannot be determined (such as parse errors), the response `id` MUST be `null`. From the JSON-RPC 2.0 spec: "If there was an error in detecting the id in the Request object (e.g. Parse error/Invalid Request), it MUST be Null."

ACP inherits this requirement by building on JSON-RPC 2.0.

### Verdict: CONFIRMED
The code uses the string `'unknown'` where JSON-RPC 2.0 requires `null`. This is compounded by Issue 076 — the `correlationId` field itself is non-standard, but even within the current design, `'unknown'` is the wrong fallback value. A client following JSON-RPC 2.0 conventions would not recognize `'unknown'` as indicating an unparseable request.

## Remediation
1. If adopting the fix from ISS-076 (removing `correlationId`, using `id` directly): set response `id` to `null` for parse errors
2. If keeping the current `correlationId` pattern: use `null` instead of `'unknown'`
3. Update the `IpcResponse` type to allow `correlationId: string | null` (or `id: string | number | null` if fixing ISS-076)
4. Update `buildResponse()` signature to accept `null` for the correlation parameter
