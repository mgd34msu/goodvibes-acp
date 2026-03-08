# ISS-031 — PID file left orphaned if socket binding fails

**Severity**: Major
**File**: `src/extensions/lifecycle/daemon.ts`
**KB Topic**: KB-10: Daemon Lifecycle

## Original Issue
The PID file is written before TCP and health servers attempt to bind. If either throws (e.g., EADDRINUSE), the `start()` method rejects but the PID file remains on disk. The `stop()` method is never called because `_running` was never set to `true`.

## Verification

### Source Code Check
Lines 144-146 of `daemon.ts`:
```typescript
if (options.pidFile) {
  await writeFile(options.pidFile, String(process.pid), 'utf-8');
}
```
This is executed before `_startTcpServer` (line 149) and `_startHealthServer` (line 152). `_running` is only set to `true` at line 154, after both servers bind successfully. There is no try/catch wrapping the startup sequence, so if either server fails to bind, the PID file remains and `stop()` (which cleans up the PID file) is never called because `_running` is `false`.

### ACP Spec Check
KB-10 (Implementation Guide) covers daemon lifecycle under the Bootstrap section (lines 170-173). While the spec does not mandate specific PID file behavior, leaving orphaned PID files is a resource leak that prevents subsequent daemon starts from detecting whether a prior process is alive.

### Verdict: CONFIRMED
The PID file is written unconditionally before fallible socket binding operations, with no cleanup path on failure. This is a real bug that causes orphaned PID files.

## Remediation
1. Wrap the startup sequence (`_startTcpServer` + `_startHealthServer`) in a try/catch block.
2. In the catch handler, delete the PID file if it was written: `await unlink(options.pidFile).catch(() => {})`.
3. Re-throw the original error after cleanup.
4. Alternatively, defer PID file creation until after both servers have successfully bound (move it after line 152).
