# ISS-070 — setState allows arbitrary state transitions without validation

**Severity**: Minor
**File**: `src/extensions/sessions/manager.ts`
**KB Topic**: KB-03: Session Lifecycle

## Original Issue
`setState` allows any state transition without validation. A session in `completed` state could be transitioned back to `idle`. Reverse transitions are likely bugs.

## Verification

### Source Code Check
In `src/extensions/sessions/manager.ts` lines 194-202, `setState` accepts any `SessionState` and applies it unconditionally:
```typescript
async setState(sessionId: string, state: SessionState): Promise<void> {
  const stored = this._requireStored(sessionId);
  const from = stored.state;
  const updated: StoredContext = { ...stored, state, updatedAt: Date.now() };
  this._store.set(NS, sessionId, updated);
  this._bus.emit('session:state-changed', { sessionId, from, to: state });
}
```
No transition validation is performed. Any state can transition to any other state.

### ACP Spec Check
KB-03 defines session lifecycle states and transitions (idle, active, completed, etc.). While KB-03 does not explicitly enumerate a state transition table, the session lifecycle implies a directed flow (e.g., sessions move from idle to active to completed). Allowing reverse transitions (completed to idle) could violate implicit lifecycle semantics and lead to bugs in ACP session management.

### Verdict: CONFIRMED
The code allows arbitrary state transitions without validation. While KB-03 does not provide an explicit transition matrix, the session lifecycle has an implied directionality. Unrestricted transitions can lead to invalid session states that break ACP session semantics.

## Remediation
1. Define an allowed transitions map:
```typescript
const ALLOWED_TRANSITIONS: Record<SessionState, SessionState[]> = {
  idle: ['active'],
  active: ['idle', 'completed', 'error'],
  completed: [],
  error: ['idle'],
};
```
2. Validate transitions in `setState` before applying
3. Throw or log an error for invalid transitions
4. If some transitions need to bypass validation (e.g., admin reset), add a `force` parameter
