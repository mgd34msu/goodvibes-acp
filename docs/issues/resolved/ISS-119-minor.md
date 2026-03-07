# ISS-119 — waitForExit() Does Not Support timeout Parameter

**Severity**: Minor
**File**: src/extensions/acp/terminal-bridge.ts:156-168
**KB Topic**: Filesystem & Terminal

## Original Issue

**[src/extensions/acp/terminal-bridge.ts:156-168]** `waitForExit()` does not support `timeout` parameter. Spec defines `terminal/wait_for_exit` with optional `timeout`. *(Filesystem & Terminal)*

## Verification

### Source Code Check

`terminal-bridge.ts` lines 156-168:

```typescript
async waitForExit(handle: TerminalHandle): Promise<ExitResult> {
  const internal = this._requireHandle(handle.id);
  const startedAt = Date.now();

  if (internal.kind === 'acp') {
    const exitResult = await internal.acpHandle.waitForExit();
    const outputResult = await internal.acpHandle.currentOutput();
    return {
      exitCode: exitResult.exitCode ?? 0,
      stdout: outputResult.output,
      stderr: '',
      durationMs: Date.now() - startedAt,
    };
  }
  // ... spawn-backed wait
}
```

The method accepts only `handle: TerminalHandle` with no `timeout` parameter. On line 161, `internal.acpHandle.waitForExit()` is called with no arguments — no timeout is passed to the ACP SDK.

For spawn-backed terminals (lines 171-195), the promise also waits indefinitely with no timeout mechanism.

### ACP Spec Check

KB `07-filesystem-terminal.md` defines `terminal/wait_for_exit` request:

```json
{
  "method": "terminal/wait_for_exit",
  "params": {
    "sessionId": "sess_abc123def456",
    "terminalId": "term_xyz789",
    "timeout": 60000
  }
}
```

The `timeout` field is optional but supported. The SDK's `ITerminalSession` mapping shows:
```typescript
async waitForExit(timeout?: number): Promise<number>;
```

Without timeout support, the agent blocks indefinitely on a hung process, making it impossible to implement timeout-based task cancellation or WRFC turn limits.

### Verdict: CONFIRMED

The issue is confirmed. The `waitForExit()` method has no timeout parameter and cannot forward one to the ACP call. This causes indefinite blocking for hung processes — a significant operational issue for long-running commands.

## Remediation

1. Add `timeout?: number` parameter to `waitForExit()`:
   ```typescript
   async waitForExit(handle: TerminalHandle, timeout?: number): Promise<ExitResult>
   ```
2. Forward to the ACP handle:
   ```typescript
   const exitResult = await internal.acpHandle.waitForExit(timeout !== undefined ? { timeout } : undefined);
   ```
3. For spawn-backed terminals, implement timeout via `Promise.race()`:
   ```typescript
   const timeoutPromise = timeout !== undefined
     ? new Promise<never>((_, reject) =>
         setTimeout(() => reject(new Error(`Terminal timed out after ${timeout}ms`)), timeout)
       )
     : null;
   const waitPromise = new Promise<ExitResult>((resolve) => { /* existing logic */ });
   return timeoutPromise ? Promise.race([waitPromise, timeoutPromise]) : waitPromise;
   ```
4. Update `ITerminal` interface to include the `timeout` parameter.
5. Update all callers to pass appropriate timeouts.
