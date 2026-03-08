# ISS-079 — `timeout` not forwarded to ACP SDK `currentOutput()` call
**Severity**: Minor
**File**: `src/extensions/acp/terminal-bridge.ts`
**KB Topic**: KB-07: Terminal Output

## Original Issue
KB-07 shows `terminal/output` accepts an optional `timeout` parameter. The code uses a local `Promise.race` workaround instead of forwarding timeout to the SDK.

## Verification

### Source Code Check
Lines 154-166 of `terminal-bridge.ts`:
```typescript
// ISS-073: The ACP SDK's currentOutput() does not currently accept a timeout
// parameter (Expected 0 arguments). The timeout is consumed locally via
// Promise.race as a fallback.
const outputPromise = internal.acpHandle.currentOutput();
const result = timeout !== undefined
  ? await Promise.race([outputPromise, new Promise<never>((_, reject) => ...)])
  : await outputPromise;
```
The code documents that the SDK's `currentOutput()` does not accept a timeout parameter, and uses `Promise.race` as a local workaround.

### ACP Spec Check
KB-07 defines `terminal/output` with an optional `timeout` field:
```json
{
  "method": "terminal/output",
  "params": {
    "sessionId": "...",
    "terminalId": "...",
    "timeout": 5000
  }
}
```
The spec supports timeout, but the SDK implementation does not yet expose it.

### Verdict: PARTIAL
The issue correctly identifies the gap between the ACP spec (which supports `timeout`) and the implementation. However, this is an SDK limitation, not a code bug in the agent. The code already implements a reasonable workaround via `Promise.race` and documents the limitation with a tracking reference (ISS-073). The timeout semantic is functionally achieved, just not through the SDK's native API.

## Remediation
1. Track ISS-073 — when the ACP SDK adds timeout support to `currentOutput()`, update to forward the parameter directly.
2. Current `Promise.race` workaround is acceptable as a temporary measure.
