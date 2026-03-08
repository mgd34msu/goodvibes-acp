# ISS-028 — `uncaughtException` / `unhandledRejection` Bypass Shutdown Manager

**Severity**: Major
**File**: src/main.ts:402-410
**KB Topic**: Implementation Guide Section 14 — Shutdown Checklist (10-implementation-guide.md)

## Original Issue
Both `uncaughtException` and `unhandledRejection` handlers call `process.exit(1)` directly without invoking `shutdownManager.shutdown()`, bypassing session finish notifications, PID cleanup, and memory persistence.

## Verification

### Source Code Check
Lines 402-410 of `main.ts`:
```typescript
process.on('uncaughtException', (err) => {
  console.error('[goodvibes-acp] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[goodvibes-acp] Unhandled rejection:', reason);
  process.exit(1);
});
```
Both handlers log the error and immediately call `process.exit(1)` without calling `shutdownManager.shutdown()`. Compare with the graceful `shutdown()` function at lines 392-396:
```typescript
async function shutdown(signal: string): Promise<void> {
  console.error(`[goodvibes-acp] Received ${signal}, shutting down...`);
  healthCheck.markShuttingDown();
  await shutdownManager.shutdown();
  process.exit(0);
}
```
The SIGINT/SIGTERM handler properly calls `shutdownManager.shutdown()`, but the exception handlers do not.

### ACP Spec Check
KB-10 (10-implementation-guide.md) requires graceful teardown on process termination. The implementation guide shows that on shutdown, the agent must send `{ sessionUpdate: 'finish', stopReason: 'cancelled' }` for each active ACP session. Bypassing the shutdown manager means:
- No `finish` events are sent to active sessions
- PID files are not cleaned up
- Memory/state persistence is skipped
- Active connections are abruptly severed

### Verdict: CONFIRMED
The code directly calls `process.exit(1)` in both exception handlers, completely bypassing `shutdownManager.shutdown()`. Active ACP sessions will experience abrupt disconnection with no `finish` event or `stopReason`. This is a clear violation of the ACP shutdown requirements.

## Remediation
1. Replace `process.exit(1)` with `shutdownManager.shutdown()` in both handlers:
   ```typescript
   process.on('uncaughtException', (err) => {
     console.error('[goodvibes-acp] Uncaught exception:', err);
     shutdownManager.shutdown().finally(() => process.exit(1));
   });
   ```
2. Add a timeout to prevent hanging if shutdown itself fails:
   ```typescript
   const SHUTDOWN_TIMEOUT_MS = 5000;
   setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
   ```
3. Consider whether uncaught exceptions should attempt to send `stopReason: 'cancelled'` or a new error-specific reason to clients
