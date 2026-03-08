# ISS-065 — authenticate method returns Promise<void> instead of response object

**Severity**: Minor
**File**: `src/extensions/acp/agent.ts`
**KB Topic**: KB-01: Authentication

## Original Issue
The ACP spec describes an authenticate response. Returning void means the JSON-RPC response will have `result: null` instead of a structured response object.

## Verification

### Source Code Check
In `src/extensions/acp/agent.ts` line 346, the `authenticate` method is:
```typescript
async authenticate(_params: schema.AuthenticateRequest): Promise<void> {
  // No auth required
}
```
This returns `undefined`, which serializes to `result: null` on the JSON-RPC wire.

### ACP Spec Check
The SDK defines `AuthenticateResponse` as an object with optional `_meta` field (`{ _meta?: { [key: string]: unknown } | null }`). KB-01 lists authenticate as a baseline method with a response. The JSON-RPC spec requires the `result` field to contain the method's return value. Returning `null` instead of `{}` is technically non-conformant.

### Verdict: CONFIRMED
The method returns `void` (serialized as `null`) instead of an `AuthenticateResponse` object (`{}`). While the agent doesn't require auth, it should still return a well-formed response object per the SDK type contract.

## Remediation
1. Change return type from `Promise<void>` to `Promise<schema.AuthenticateResponse>`
2. Return `{}` (empty object) to satisfy the response type
3. Example: `async authenticate(_params: schema.AuthenticateRequest): Promise<schema.AuthenticateResponse> { return {}; }`
