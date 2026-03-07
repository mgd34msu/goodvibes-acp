# ISS-149 — ShutdownManager Timeout Timer Never Cleared on Success

**Severity**: Minor
**File**: src/extensions/lifecycle/shutdown.ts
**KB Topic**: Initialization

## Original Issue
Timeout timer never cleared on success — timer leak.

## Verification

### Source Code Check
Lines 103–119 of `src/extensions/lifecycle/shutdown.ts`:

```typescript
private async _runWithTimeout(entry: HandlerEntry): Promise<void> {
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Shutdown handler "${entry.name}" timed out after ${HANDLER_TIMEOUT_MS}ms`)),
      HANDLER_TIMEOUT_MS,
    ),
  );

  try {
    await Promise.race([entry.handler(), timeoutPromise]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[ShutdownManager] Warning during shutdown of "${entry.name}": ${message}`);
  }
}
```

The `setTimeout` timer ID is never captured and never passed to `clearTimeout`. When `entry.handler()` completes successfully before the timeout, `Promise.race` resolves and the function returns — but the `setTimeout` callback is still pending in the event loop. The dangling timeout will fire after `HANDLER_TIMEOUT_MS` (10 seconds) and attempt to call `reject()` on an already-settled Promise, which is a no-op (Promises ignore subsequent settle calls) but the timer itself represents a resource leak that keeps the Node.js/Bun event loop alive longer than necessary during shutdown.

This is particularly problematic during shutdown — the daemon may hang for up to 10 seconds after all handlers complete because the event loop is kept alive by dangling timers.

### ACP Spec Check
The ACP spec does not specify requirements for shutdown timer management. However, the ACP KB (`02-initialization.md`) describes orderly shutdown as important for client-agent lifecycle management. A dangling timer that delays process exit could cause the ACP client to see the agent process fail to terminate promptly, potentially blocking editor shutdown.

This is a real resource leak that can affect ACP runtime behavior during shutdown, though the spec itself does not mandate how shutdown timers are implemented.

### Verdict: CONFIRMED
The code has the problem described. `setTimeout` is called without capturing the timer ID, so `clearTimeout` can never be called. This creates a timer leak on every successful handler completion, potentially delaying process exit during shutdown by up to `HANDLER_TIMEOUT_MS` (10,000ms) per handler.

## Remediation
Capture the timer ID and clear it on success:

```typescript
private async _runWithTimeout(entry: HandlerEntry): Promise<void> {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<void>((_, reject) => {
    timerId = setTimeout(
      () => reject(new Error(`Shutdown handler "${entry.name}" timed out after ${HANDLER_TIMEOUT_MS}ms`)),
      HANDLER_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([entry.handler(), timeoutPromise]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[ShutdownManager] Warning during shutdown of "${entry.name}": ${message}`);
  } finally {
    clearTimeout(timerId);
  }
}
```

Using `finally` ensures the timer is always cleared whether the handler succeeds, times out, or throws.
