# ISS-073 — `terminal/output` Timeout Not Forwarded to Client

**Severity**: Minor
**File**: src/extensions/acp/terminal-bridge.ts:154
**KB Topic**: Terminal Methods — `terminal/output` (07-filesystem-terminal.md lines 281-285)

## Original Issue
Timeout is handled locally via `Promise.race` and never sent to the client in the `terminal/output` request.

## Verification

### Source Code Check
Lines 150-167 of `src/extensions/acp/terminal-bridge.ts` confirm the issue:

```typescript
async output(handle: TerminalHandle, timeout?: number): Promise<{ output: string; exitCode: number | null }> {
    const internal = this._requireHandle(handle.id);

    if (internal.kind === 'acp') {
      const outputPromise = internal.acpHandle.currentOutput();
      const result: schema.TerminalOutputResponse = timeout !== undefined
        ? await Promise.race([
            outputPromise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`output() timed out after ${timeout}ms`)), timeout)
            ),
          ])
        : await outputPromise;
```

The `timeout` parameter is consumed locally in a `Promise.race` but is never passed to `currentOutput()` as a request parameter. The ACP client never sees the timeout value.

### ACP Spec Check
KB-07 (07-filesystem-terminal.md lines 131-135) defines the `terminal/output` request with an optional `timeout` field:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | yes | Active session ID |
| `terminalId` | string | yes | Terminal ID from `terminal/create` |
| `timeout` | number | no | Max ms to wait for output |

The spec intends the timeout to be sent to the client so it can handle the waiting server-side.

### Verdict: CONFIRMED
The timeout is consumed locally via `Promise.race` instead of being forwarded as a parameter in the `terminal/output` ACP request. This means the agent-side timeout races against the network round-trip, and the client cannot optimize its behavior (e.g., waiting for new output before responding).

## Remediation
1. Pass the `timeout` value to `internal.acpHandle.currentOutput()` so it is included in the `terminal/output` request params sent to the client
2. Optionally keep a local timeout as a safety net, but set it slightly longer than the forwarded timeout to allow for network latency
3. Verify the SDK's `currentOutput()` method accepts and forwards the timeout parameter
