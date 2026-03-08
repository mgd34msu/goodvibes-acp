# ISS-027: waitForExit silently defaults exitCode to 0 when null — masks failures

**Source**: `src/extensions/acp/terminal-bridge.ts` (line 202)
**KB Reference**: KB-07: Terminal Exit
**Severity**: Medium

### Verdict: CONFIRMED

**Finding**: The code uses `exitResult.exitCode ?? 0` which converts a null exit code to 0 (success). KB-07 defines `exitCode` as `number | null` where null means "still running" or the process was killed by a signal.

The `terminal/wait_for_exit` response schema (KB-07 line 303) states:
> `exitCode` | number | null | Process exit code, or null if still running

The SDK's `WaitForTerminalExitResponse` preserves the null semantics. Defaulting to 0 masks:
- Signal-killed processes (SIGKILL, SIGTERM) which may have no numeric exit code
- Processes still running (edge case if `waitForExit` returns prematurely)

This is a genuine ACP compliance issue because it alters the semantic meaning of the exit code returned by the protocol.

### Remediation

1. Preserve the null value: `exitCode: exitResult.exitCode` and update `ExitResult` type to allow `number | null`
2. If `ExitResult.exitCode` must be numeric, use a sentinel like `-1` to indicate abnormal termination, and document this mapping
3. Callers should be able to distinguish "exited with code 0" from "exited abnormally"
