# ISS-044: Terminal bridge timer leak in Promise.race timeout patterns

**Severity**: Major  
**File**: `src/extensions/acp/terminal-bridge.ts`  
**Lines**: 160-165, 212-216, 249-254  
**KB Reference**: KB-10 (Implementation)

## Description

Three `Promise.race` timeout patterns in the terminal bridge create timers via `setTimeout` that are never cleared when the primary promise wins the race. This leaks timer references.

## Source Evidence

In the `output()` method (lines ~65-72):
```typescript
await Promise.race([
  outputPromise,
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(...), timeout)
  ),
]);
```

Same pattern in `waitForExit()` for both the ACP path (lines ~118-123) and the spawn path (lines ~151-156). None of these patterns store the `setTimeout` return value or call `clearTimeout`.

Notably, the `ShutdownManager._runWithTimeout()` in `src/extensions/lifecycle/shutdown.ts` correctly stores `timerId` and calls `clearTimeout(timerId)` in a `finally` block.

### Verdict: CONFIRMED

All three `Promise.race` timeout patterns leak timer references. The correct pattern already exists in the codebase (ShutdownManager) but was not applied here.

## Remediation

Store the setTimeout return value and clear it when the primary promise resolves:

```typescript
let timerId: ReturnType<typeof setTimeout>;
const timeoutPromise = new Promise<never>((_, reject) => {
  timerId = setTimeout(() => reject(new Error(`... timed out after ${timeout}ms`)), timeout);
});
try {
  return await Promise.race([primaryPromise, timeoutPromise]);
} finally {
  clearTimeout(timerId!);
}
```

Apply this pattern to all three locations in terminal-bridge.ts.
