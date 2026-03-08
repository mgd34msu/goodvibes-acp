# ISS-017 — Random toolCallId generation breaks spec-required linkage

**Severity**: Major
**File**: src/extensions/acp/permission-gate.ts
**KB Topic**: KB-05: Relationship to Tool Execution

## Original Issue
KB-05: "toolCallId used in permission context should match the tool_call update sent before the request." The code generates a random UUID as fallback. A randomly generated `toolCallId` will not match any preceding `tool_call` update, breaking client UI correlation.

## Verification

### Source Code Check
At line ~170 of `src/extensions/acp/permission-gate.ts`:
```typescript
const toolCallId = request.toolCallId ?? randomUUID();
```
When `request.toolCallId` is undefined, a random UUID is generated that will not match any preceding `tool_call` session update.

### ACP Spec Check
KB-05 line 419 states: "toolCallId used in permission context should match the tool_call update sent before the request."

The ACP permission flow (KB-05 lines 189-196) shows:
1. Agent reports `tool_call` (status: "pending") with a `toolCallId`
2. Agent sends `session/request_permission` (blocks)
3. After grant/deny, agent reports `tool_call_update` with the same `toolCallId`

A random fallback ID breaks the linkage between steps 1, 2, and 3. Clients cannot correlate the permission request with the tool call in their UI.

### Verdict: CONFIRMED
The random UUID fallback directly violates the spec requirement that the toolCallId in the permission request must match the preceding tool_call update. This breaks client UI correlation between tool calls and their permission gates.

## Remediation
1. Make `toolCallId` required on `PermissionRequest` (remove the optional `?` modifier), or
2. Throw an error when `toolCallId` is missing rather than silently generating a random one, or
3. At minimum, emit a warning log when falling back to a random UUID so the issue is visible during development.
