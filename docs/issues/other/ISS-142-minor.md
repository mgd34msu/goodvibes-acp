# ISS-142 — State Machine Async Hook Errors Silently Swallowed

**Severity**: Minor
**File**: src/core/state-machine.ts
**KB Topic**: Overview

## Original Issue
Async `onEnter`/`onExit` hooks are fire-and-forget — errors silently swallowed with `catch(() => {})`. State entry/exit side effects (e.g., persisting session state) can fail silently.

## Verification

### Source Code Check
Lines 159–165 of `src/core/state-machine.ts`:

```typescript
if (exitConfig?.onExit) {
  try {
    const result = exitConfig.onExit(this._context, t.to);
    // Sync — we don't await hooks to keep transition atomic
    if (result instanceof Promise) {
      result.catch(() => { /* errors in hooks are swallowed */ });
    }
  } catch { /* swallow */ }
}
```

The comment itself acknowledges the deliberate design: "Sync — we don't await hooks to keep transition atomic." Both the sync throw path and the async rejection path are silently caught with empty handlers. This pattern is repeated for `onEnter` hooks and for `_exitHandlers`/`_enterHandlers`.

### ACP Spec Check
The ACP spec does not define requirements for internal state machine hook error handling. This is an internal L1 core implementation concern. The spec defines session state transitions at the protocol level (e.g., `session/update` notifications) but says nothing about how agents must handle errors in their internal state entry/exit callbacks.

However, KB file `01-overview.md` describes ACP agents as responsible for maintaining session state integrity. If an `onEnter` hook that persists session state silently fails, the agent may send incorrect `session_info` session updates — which would be an ACP compliance problem downstream.

### Verdict: NOT_ACP_ISSUE
The code has the problem described. Silent error swallowing in hooks is a real reliability concern — failures in session persistence side effects could produce ACP protocol inconsistencies downstream. However, the issue itself is not an ACP spec compliance violation; it is an internal code quality problem. The ACP spec does not mandate how agents handle their internal hook errors.

## Remediation
1. Emit errors to the `EventBus` rather than swallowing them:
   ```typescript
   result.catch((err) => {
     this._eventBus?.emit('core:state-machine-hook-error', { hook: 'onExit', from: this._current, to: t.to, error: err });
   });
   ```
2. Add an `eventBus` optional dependency to `StateMachine` constructor.
3. For critical hooks (e.g., session persistence), consider awaiting and aborting the transition on failure.
