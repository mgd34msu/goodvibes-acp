# ISS-067: Cancellation handling doesn't conform to spec

**Severity**: Major
**File**: src/extensions/acp/permission-gate.ts
**Line(s)**: 80-86 (isGranted), 153-155 (catch block)
**Topic**: Permissions

## Issue Description
Cancellation handling during permission requests doesn't conform to spec. Spec says if client sends `session/cancel` while permission is in-flight, resolve as `granted: false` with `stopReason: "cancelled"`. Implementation uses generic error catch.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 383-390
- **Spec Says**: "If the client sends a `session/cancel` while `session/request_permission` is in-flight: (1) The SDK delivers the cancel to the agent, (2) The pending permission request should be resolved as `granted: false`, (3) Agent cleans up and sends final `session/prompt` response with `stopReason: "cancelled"`"
- **Confirmed**: Yes
- **Notes**: The spec is explicit about the cancellation flow. The current implementation catches all errors identically.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 153-155 show a bare `catch` block that returns `{ status: 'denied', reason: 'Permission request failed' }`. No distinction between cancellation and other errors. No `stopReason` propagation. The `isGranted` function (lines 80-86) handles `outcome === 'cancelled'` by returning false, but the catch block conflates SDK-level cancellation errors with network/other errors.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Distinguish cancellation errors from other errors in the catch block
2. When the error is due to `session/cancel`, return `{ status: 'denied', reason: 'cancelled' }` with a distinct signal
3. Propagate cancellation reason up so the prompt handler can return `stopReason: 'cancelled'`
4. Check for `AbortError` or SDK-specific cancellation error type in the catch
