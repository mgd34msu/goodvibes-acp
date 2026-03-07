# ISS-168 — SessionState Lacks paused/suspended States

**Severity**: Nitpick
**File**: src/types/session.ts:13
**KB Topic**: Sessions

## Original Issue
**[src/types/session.ts:13]** `SessionState` lacks `'paused'`/`'suspended'` states for long-running sessions. *(Sessions)*

## Verification

### Source Code Check
```typescript
/** Lifecycle states of an ACP session */
export type SessionState = 'idle' | 'active' | 'cancelled' | 'completed';
```
The type covers 4 states: `idle`, `active`, `cancelled`, `completed`. There are no `paused` or `suspended` states.

### ACP Spec Check
The ACP specification does not define a `SessionState` enumeration. The spec defines session lifecycle through method calls (`session/new`, `session/load`, `session/cancel`) and `stopReason` values (`end_turn`, `max_tokens`, `max_turn_requests`, `refusal`, `cancelled`). The spec does not mention `paused` or `suspended` session states at the protocol level.

From the sessions KB: The session persistence/resumption flow is: new → prompt → (store sessionId) → load → prompt again. There is no protocol-level concept of "pausing" — sessions are either active or fully ended, resumable via `session/load`.

### Verdict: NOT_ACP_ISSUE
The ACP spec does not define `paused` or `suspended` session states. `SessionState` is a GoodVibes-internal type for tracking session lifecycle — its design is not mandated by the protocol. Adding `paused`/`suspended` would be a GoodVibes-specific extension. The current states adequately cover the ACP-defined lifecycle transitions.

## Remediation
N/A — Not an ACP compliance issue.
