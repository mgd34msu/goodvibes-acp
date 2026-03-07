# ISS-082: IPC deserializer validation incomplete

**Severity**: Major
**File**: src/extensions/ipc/protocol.ts
**Line(s)**: 73-88
**Topic**: TypeScript SDK

## Issue Description
Deserializer validation incomplete -- no type discriminant validation, no method field check on requests, no message size limit.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/09-typescript-sdk.md
- **Spec Says**: No specific guidance found in the TypeScript SDK KB regarding IPC message validation, discriminant checks, or size limits. The IPC layer is an internal implementation detail, not an ACP protocol concern.
- **Confirmed**: No
- **Notes**: The ACP spec does not define IPC message formats or validation requirements. This is an internal protocol between L1/L2 layers.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `deserializeMessage()` at lines 73-88 validates that parsed JSON has `type` (string), `id` (string), and `timestamp` (number) fields. It does NOT validate the `type` value against known discriminants (e.g., 'request' vs 'response'), does NOT check for `method` field presence on request-type messages, and has no message size limit before parsing.
- **Issue Confirmed**: Partial -- the validation gaps are real but this is not an ACP spec compliance issue.

## Verdict
NOT_ACP_ISSUE

## Remediation Steps
1. Add discriminant validation: check `type` is one of known values ('request', 'response', 'notification')
2. For request messages, validate `method` field is present and is a string
3. Consider adding a message size limit check before JSON.parse to prevent DoS via large payloads
