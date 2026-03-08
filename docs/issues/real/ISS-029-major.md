# ISS-029 — `shutdown()` Calls `process.exit(0)` Before Pending Writes Flush

**Severity**: Major
**File**: src/main.ts:392-396
**KB Topic**: Implementation Guide Section 5 — Stop Reasons (10-implementation-guide.md)

## Original Issue
`shutdown()` calls `process.exit(0)` immediately after `shutdownManager.shutdown()` without awaiting pending I/O flushes. If finish events are emitted during shutdown but `process.exit(0)` fires before they flush, the client never receives them.

## Verification

### Source Code Check
Lines 392-396 of `main.ts`:
```typescript
async function shutdown(signal: string): Promise<void> {
  console.error(`[goodvibes-acp] Received ${signal}, shutting down...`);
  healthCheck.markShuttingDown();
  await shutdownManager.shutdown();
  process.exit(0);
}
```
The function does `await shutdownManager.shutdown()` which will run all registered shutdown handlers (including emitting `finish` events). Then it calls `process.exit(0)`.

The question is whether `shutdownManager.shutdown()` awaits I/O flush completion, or just fires-and-forgets the finish events. If `shutdown()` properly awaits all handlers including their I/O operations, then `process.exit(0)` after the await would be safe.

However, `process.exit(0)` is synchronous and forceful — it terminates the process immediately, potentially before Node.js/Bun's event loop drains all pending I/O (e.g., pending socket writes for `finish` notifications).

### ACP Spec Check
KB-10 (10-implementation-guide.md) shows `finish` events with `stopReason` must be delivered to clients. The implementation guide example shows:
```typescript
update: { sessionUpdate: 'finish', stopReason: 'cancelled' }
```
If this notification is emitted but `process.exit(0)` runs before the TCP write buffer flushes, the client never receives the finish event.

### Verdict: CONFIRMED
While `shutdownManager.shutdown()` is properly awaited, `process.exit(0)` is still problematic because:
1. It terminates before the Node.js/Bun event loop can drain pending I/O (socket writes)
2. Finish events may be queued but not yet flushed to the network
3. The proper approach is to let the process exit naturally after cleanup, or use `setTimeout(() => process.exit(0), delay).unref()` as a safety net

## Remediation
1. Remove the immediate `process.exit(0)` call
2. After `await shutdownManager.shutdown()`, allow a brief drain period for I/O:
   ```typescript
   async function shutdown(signal: string): Promise<void> {
     console.error(`[goodvibes-acp] Received ${signal}, shutting down...`);
     healthCheck.markShuttingDown();
     await shutdownManager.shutdown();
     // Safety timeout — process should exit naturally when all handles close
     setTimeout(() => process.exit(0), 2000).unref();
   }
   ```
3. Alternatively, ensure all connections are properly closed (which removes the handles keeping the event loop alive), allowing natural process exit
