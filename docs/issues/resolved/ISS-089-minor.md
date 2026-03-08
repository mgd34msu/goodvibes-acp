# ISS-089: Arbitrary 2-second exit delay after graceful shutdown

**Source**: `src/main.ts` line 436  
**KB Reference**: KB-10 (Graceful Shutdown)  
**Severity**: Minor

## Description

After `shutdownManager.shutdown()` completes, a 2-second `setTimeout` delays `process.exit(0)`. This is arbitrary -- it may be too short for slow I/O draining or unnecessarily long for clean shutdowns.

## Evidence

`main.ts:436`:
```typescript
async function shutdown(signal: string): Promise<void> {
  console.error(`[goodvibes-acp] Received ${signal}, shutting down...`);
  healthCheck.markShuttingDown();
  await shutdownManager.shutdown();
  setTimeout(() => process.exit(0), 2000).unref();
}
```

The comment says "Allow the event loop to drain pending I/O" but shutdown handlers already handle their own cleanup. The 2-second delay is not tied to any observable condition.

### Verdict: CONFIRMED

The hardcoded 2-second delay is arbitrary and not conditioned on any actual pending work. It adds unnecessary latency to clean shutdowns while potentially being insufficient for slow ones.

## Remediation

1. Replace `setTimeout(() => process.exit(0), 2000)` with `setImmediate(() => process.exit(0))` to allow a single event loop tick for pending I/O.
2. Alternatively, use a shorter timeout (e.g., 100ms) as a safety margin.
3. If specific cleanup needs time after shutdown handlers complete, that logic should be inside a shutdown handler, not after all handlers have completed.
