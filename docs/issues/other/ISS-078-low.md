# ISS-078 — Session state machine lacks `error` handling state
**Severity**: Low
**File**: `src/extensions/sessions/manager.ts`
**KB Topic**: KB-04: Sessions

## Original Issue
No `error` state for sessions that fail during prompt turn. Failed sessions remain `active`.

## Verification

### Source Code Check
`src/extensions/sessions/manager.ts` lines 40-45:
```
const ALLOWED_TRANSITIONS: Readonly<Record<SessionState, SessionState[]>> = {
  idle: ['active'],
  active: ['idle', 'cancelled', 'completed'],
  cancelled: [],
  completed: [],
};
```
Four states: `idle`, `active`, `cancelled`, `completed`. No `error` or `failed` state.

### ACP Spec Check
KB-03 and KB-04 do not define an `error` session state. The ACP protocol session lifecycle uses `session/prompt` request/response pairs and `session/update` notifications. Session-level errors are communicated via `stopReason` values (e.g., `"refusal"`) in the prompt response, not via a separate session state. The `cancelled` state handles user-initiated cancellation.

### Verdict: NOT_ACP_ISSUE
The ACP protocol does not define an `error` session state. The existing states (`idle`, `active`, `cancelled`, `completed`) match the protocol's session lifecycle. Errors during prompt turns are communicated via `stopReason` in the prompt response, which is the correct ACP mechanism. Adding an internal `error` state would be a design choice, not an ACP compliance requirement.

## Remediation
1. Optional: Add an internal `error` state for tracking purposes, with transitions from `active`.
2. This is not required for ACP compliance.
