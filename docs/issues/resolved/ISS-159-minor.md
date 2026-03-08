# ISS-159: `MemoryManager` session cleanup not wired to `session/cancel`

**Source**: `src/extensions/memory/manager.ts` lines 118-126
**KB Reference**: KB-04 (Cancellation)
**Severity**: Minor

## Issue Description
`clearSession()` is wired to `session:destroyed` but not `session/cancel`. The issue claims pending session-scoped memory writes persist between cancel and destroy.

### Verdict: PARTIAL

The code at lines 121-126 wires `clearSession` to `session:destroyed` only. However, per KB-04, `session/cancel` cancels an **in-progress prompt turn**, not the session itself. After cancellation, the session remains active and the client may send new `prompt/start` requests. Clearing session-scoped memory on cancel would be incorrect -- it would destroy state that the next prompt turn in the same session may need.

The issue is partially valid in that the behavior should be explicitly documented, but wiring cleanup to `session/cancel` would likely be wrong. The current behavior (cleanup on `session:destroyed`) is correct for session lifecycle management.

## Remediation
1. Add a code comment explaining why `session/cancel` does not trigger cleanup: `// session/cancel cancels a prompt turn, not the session -- memory persists for subsequent turns`
2. If there are specific transient/turn-scoped memory entries that should be cleared on cancel, add a separate `clearTurnData(sessionId)` method wired to `session:cancelled`
3. Document the distinction between turn-scoped and session-scoped memory in the module docs
