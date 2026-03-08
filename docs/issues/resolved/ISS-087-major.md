# ISS-087: Redundant shutdown calls from uncaught exception/rejection handlers

**Source**: `src/main.ts` lines 442-454  
**KB Reference**: KB-10 (Error Handling)  
**Severity**: Major

## Description

Both `uncaughtException` and `unhandledRejection` handlers unconditionally start a 5-second safety timer and call `shutdownManager.shutdown()`. If a legitimate shutdown is already in progress (from SIGINT/SIGTERM), the safety timer will force-exit prematurely with `process.exit(1)` even though the graceful shutdown path is working correctly.

## Evidence

`main.ts:442-454`:
```typescript
process.on('uncaughtException', (err) => {
  console.error('[goodvibes-acp] Uncaught exception:', err);
  setTimeout(() => process.exit(1), 5000).unref();
  shutdownManager.shutdown().finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  console.error('[goodvibes-acp] Unhandled rejection:', reason);
  setTimeout(() => process.exit(1), 5000).unref();
  shutdownManager.shutdown().finally(() => process.exit(1));
});
```

`ShutdownManager` has an `isShuttingDown()` method (shutdown.ts:78) that returns whether shutdown is already in progress. The shutdown method itself has re-entrancy protection (line 63), but the safety timer is started unconditionally regardless.

### Verdict: CONFIRMED

The safety timer and duplicate shutdown call can interfere with an in-progress graceful shutdown, potentially causing a premature `process.exit(1)` instead of the clean `process.exit(0)` from the SIGINT/SIGTERM handler.

## Remediation

1. Check `shutdownManager.isShuttingDown()` at the start of each handler.
2. If shutdown is already in progress, log the error but skip the safety timer and duplicate shutdown call.
3. Example:
```typescript
process.on('uncaughtException', (err) => {
  console.error('[goodvibes-acp] Uncaught exception:', err);
  if (shutdownManager.isShuttingDown()) return;
  setTimeout(() => process.exit(1), 5000).unref();
  shutdownManager.shutdown().finally(() => process.exit(1));
});
```
