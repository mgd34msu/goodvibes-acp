# ISS-145 — Scheduler Silently Swallows Handler Errors

**Severity**: Minor
**File**: src/core/scheduler.ts
**KB Topic**: Overview

## Original Issue
Scheduler swallows handler errors silently with no EventBus dependency for error reporting.

## Verification

### Source Code Check
Lines 232–241 of `src/core/scheduler.ts`:

```typescript
try {
  const result = task.config.handler();
  if (result instanceof Promise) {
    result.then(done).catch(() => done());
  } else {
    done();
  }
} catch {
  done();
}
```

Both the synchronous throw path (`catch { done(); }`) and the async rejection path (`.catch(() => done())`) silently swallow errors — they call `done()` to reset task state but provide no error reporting mechanism. The `Scheduler` class has no `EventBus` dependency, so there is no way to surface these failures to the runtime.

### ACP Spec Check
The ACP spec does not define requirements for internal task scheduler error handling. `Scheduler` is an L1 core utility with no ACP wire-format responsibilities. Silent failures here could indirectly affect ACP compliance (e.g., a scheduled session-keepalive task failing silently), but the spec itself does not mandate how agents handle scheduled task errors.

### Verdict: NOT_ACP_ISSUE
The code has the problem described. Silent error swallowing in the scheduler is a real reliability concern — failed scheduled tasks produce no observable signal. However, this is an internal code quality issue, not an ACP protocol compliance violation.

## Remediation
1. Add optional `EventBus` dependency to `Scheduler` constructor.
2. In the error paths, emit an error event:
   ```typescript
   result.then(done).catch((err) => {
     this._eventBus?.emit('core:scheduler-error', { taskId: task.config.id, error: err });
     done();
   });
   ```
3. Or at minimum, use `console.error` to surface failures during development.
