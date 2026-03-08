# ISS-031: No timeout enforcement on trigger handler execution

**Severity**: Major
**Category**: KB-10 Implementation
**File**: `src/core/trigger-engine.ts`
**Lines**: 227

## Description

The `ITriggerHandler` contract requires completion within the trigger timeout, but `TriggerEngine.evaluate()` has no timeout enforcement. `handler.execute()` is called as a fire-and-forget promise with only a `.catch()` for error isolation. A hanging handler will never be detected or terminated.

### Verdict: CONFIRMED

Source code at line 227 shows:
```typescript
handler.execute(definition, context).catch((err: unknown) => { ... });
```
No `Promise.race`, no timeout wrapper, no deadline enforcement. A misbehaving handler can block indefinitely with no detection mechanism.

## Remediation

1. Wrap `handler.execute()` with `Promise.race` against a configurable timeout (e.g., `definition.timeout ?? DEFAULT_TRIGGER_TIMEOUT_MS`).
2. On timeout, emit an error event via EventBus with timeout details.
3. Consider adding a `AbortController` signal to `TriggerContext` so handlers can cooperatively cancel.

## ACP Reference

KB-10: Implementation best practices require bounded execution for all async operations.
