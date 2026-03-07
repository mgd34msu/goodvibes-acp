# ISS-118 — terminal output() Discards exitCode and Ignores timeout

**Severity**: Minor
**File**: src/extensions/acp/terminal-bridge.ts:134-143
**KB Topic**: Filesystem & Terminal

## Original Issue

**[src/extensions/acp/terminal-bridge.ts:134-143]** `output()` does not forward `timeout`. Return type is `string` but spec returns `{ output: string; exitCode: number | null }` — `exitCode` is discarded. *(Filesystem & Terminal)*

## Verification

### Source Code Check

`terminal-bridge.ts` lines 134-143:

```typescript
async output(handle: TerminalHandle): Promise<string> {
  const internal = this._requireHandle(handle.id);

  if (internal.kind === 'acp') {
    const result = await internal.acpHandle.currentOutput();
    return result.output;
  }

  // Spawn-backed: combine buffered stdout
  return internal.stdout.join('');
}
```

The method:
- Returns `Promise<string>` — discards `exitCode` from the ACP response
- Accepts no `timeout` parameter — cannot forward `timeout` to ACP
- `internal.acpHandle.currentOutput()` is called with no args — no timeout forwarding
- For spawn-backed terminals, also returns only stdout (ignores stderr)

### ACP Spec Check

KB `07-filesystem-terminal.md` defines `terminal/output` response:

```json
{
  "result": {
    "output": "...",
    "exitCode": null
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `output` | string | Terminal output |
| `exitCode` | number \| null | Process exit code, or null if still running |

The spec also defines a `timeout` field on the request (optional, max ms to wait for output).

The GoodVibes `ITerminal` interface has `output(handle: TerminalHandle): Promise<string>` — so the return type mismatch is at the interface level, not just the implementation. Both the interface and implementation omit `exitCode` and `timeout`.

### Verdict: CONFIRMED

Both issues are confirmed:
1. The return type `Promise<string>` discards `exitCode` which is part of the spec `terminal/output` response. Callers lose process exit status information without having to call `waitForExit()`.
2. No `timeout` parameter exists — agents cannot specify how long to wait for output.

## Remediation

1. Update the `ITerminal` interface's `output()` signature:
   ```typescript
   output(handle: TerminalHandle, timeout?: number): Promise<{ output: string; exitCode: number | null }>;
   ```
2. Update `AcpTerminal.output()` to forward `timeout` and return the full result:
   ```typescript
   async output(handle: TerminalHandle, timeout?: number): Promise<{ output: string; exitCode: number | null }> {
     const internal = this._requireHandle(handle.id);
     if (internal.kind === 'acp') {
       const result = await internal.acpHandle.currentOutput(timeout !== undefined ? { timeout } : undefined);
       return { output: result.output, exitCode: result.exitCode ?? null };
     }
     // Spawn-backed
     return { output: internal.stdout.join(''), exitCode: internal.exitCode };
   }
   ```
3. Update all callers of `output()` to handle the new return type.
