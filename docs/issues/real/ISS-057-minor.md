# ISS-057: `SessionManager.destroy()` does not validate session state

**Severity**: Minor
**Category**: KB-04 Sessions
**File**: `src/extensions/sessions/manager.ts`
**Lines**: 146-151

## Description

The `destroy()` method unconditionally deletes session state without checking if a prompt turn is in progress. No mechanism ensures a `stopReason: "cancelled"` response is sent.

### Verdict: CONFIRMED

Source at lines 146-151:
```typescript
async destroy(sessionId: string): Promise<void> {
    this._store.delete(NS, sessionId);
    this._store.delete(NS, `${HISTORY_PREFIX}${sessionId}`);
    this._bus.emit('session:destroyed', { sessionId });
}
```
The method performs no state validation — it does not check whether a prompt is currently being processed, whether the session is in a valid state for destruction, or ensure that any in-flight operations receive a cancellation signal. The ACP `StopReason` type includes `"cancelled"` which should be used when a session is destroyed during active processing.

## Remediation

1. Check if the session has an active prompt turn before destroying.
2. If active, send a `PromptResponse` with `stopReason: "cancelled"` before cleanup.
3. Add state validation to prevent destroying already-destroyed sessions (idempotency guard).

## ACP Reference

KB-04: Session lifecycle management should ensure proper cancellation semantics. `StopReason: "cancelled"` is the correct signal for interrupted sessions.
