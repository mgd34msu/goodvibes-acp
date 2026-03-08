# ISS-053 — MemoryManager.clearSession() Never Called — Memory Leak on Session Destroy

**Severity**: Major
**File**: src/extensions/memory/manager.ts:394
**KB Topic**: Session Persistence and Resumption (03-sessions.md lines 487-497)

## Original Issue
`clearSession()` is defined but never called. When `session:destroyed` is emitted, no listener invokes cleanup. Session-scoped memory accumulates indefinitely.

## Verification

### Source Code Check
The method is defined at line 394:
```typescript
clearSession(sessionId: string): void {
  this._sessionStore.delete(sessionId);
}
```
A codebase-wide grep for `clearSession` returns only this single definition — zero call sites exist.

The `session:destroyed` event IS emitted (by `SessionManager` at line 136 and `built-ins.ts` at line 101), and `AcpSessionAdapter` listens for it at line 64, but no listener ever calls `MemoryManager.clearSession()`.

### ACP Spec Check
KB-03 (lines 487-497) describes the session lifecycle: create, use, destroy. All associated resources must be released when a session is destroyed. The `_sessionStore` Map grows unbounded as sessions are created and never cleaned up.

### Verdict: CONFIRMED
The cleanup method exists but is dead code. Every session creation adds entries to `_sessionStore` that are never removed, constituting a memory leak proportional to the number of sessions created over the process lifetime.

## Remediation
1. Register a `session:destroyed` event listener in `MemoryManager` (or its initialization code) that calls `clearSession(sessionId)`:
   ```typescript
   this.eventBus.on('session:destroyed', (event) => {
     const { sessionId } = event.payload as { sessionId: string };
     this.clearSession(sessionId);
   });
   ```
2. Alternatively, add the cleanup call in the existing `AcpSessionAdapter._onSessionDestroyed()` handler
3. Add a test verifying that `_sessionStore` is cleaned up after session destruction
