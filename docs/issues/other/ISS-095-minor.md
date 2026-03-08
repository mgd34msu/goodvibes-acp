# ISS-095 — Async lifecycle hooks are fire-and-forget

**Severity**: Minor  
**File**: `src/core/state-machine.ts`  
**Lines**: 156-165, 186-193  
**KB Reference**: None (internal quality concern)

## Description

`onEnter`/`onExit` hooks that return Promises have rejections caught and logged to `console.error`, but the transition proceeds regardless. Extension hook failures are silently swallowed.

### Verdict: NOT_ACP_ISSUE

This is an intentional design decision in the L1 state machine. The code explicitly does not await hooks to keep transitions atomic (see comment at line 162: "Sync — we don't await hooks to keep transition atomic"). Errors are logged to console.error, not silently swallowed. The issue references "KB-08" but KB-08 does not define requirements for internal state machine hook error handling.

The fire-and-forget pattern is a valid architectural choice for non-blocking state transitions.

## Remediation

Optional improvement:

1. Emit hook failures through the EventBus for structured observability.
2. Consider an optional `awaitHooks: boolean` config for transitions where hook completion matters.
