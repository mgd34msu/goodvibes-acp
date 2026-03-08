# ISS-066 — Unknown _goodvibes/* methods return success instead of JSON-RPC error

**Severity**: Minor
**File**: `src/extensions/acp/extensions.ts`
**KB Topic**: KB-01: JSON-RPC 2.0

## Original Issue
Unknown methods return `{ error: 'unknown_method', _meta: META }` as a successful response. Per JSON-RPC 2.0, unknown methods should return a JSON-RPC error with code `-32601` (METHOD_NOT_FOUND).

## Verification

### Source Code Check
In `src/extensions/acp/extensions.ts` line 74, the `handle()` method's default case returns:
```typescript
return { error: 'unknown_method', _meta: META };
```
This is a successful JSON-RPC response (no error code, no error object), just a result payload that happens to contain an `error` string field.

### ACP Spec Check
JSON-RPC 2.0 requires that when a method is not found, the server MUST return an error response with code `-32601`. The SDK's `ErrorCode` type includes `-32601` (line 836). Returning a success result with an `error` field is semantically wrong — clients expecting JSON-RPC error handling will not detect this as an error.

### Verdict: CONFIRMED
The code returns a successful JSON-RPC response for unknown methods instead of a JSON-RPC error. This violates JSON-RPC 2.0 section 5.1 which specifies error code -32601 for "Method not found".

## Remediation
1. Throw an error with code -32601 instead of returning a result:
```typescript
default: {
  const err = new Error(`Unknown extension method: ${method}`);
  (err as Error & { code: number }).code = -32601;
  throw err;
}
```
2. Alternatively, if the SDK provides a structured error class, use that
