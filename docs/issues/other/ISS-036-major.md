# ISS-036: SessionManager.load() does not emit session event for resumption

**Severity**: Major
**File**: src/extensions/sessions/manager.ts
**Line(s)**: 104-113
**Topic**: Sessions

## Issue Description
`load()` does not emit a session event for resumption.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md
- **Spec Says**: The spec does not define any specific internal event that must be emitted by the session manager upon loading. The spec only requires that history be replayed as `session/update` notifications (which is handled at the agent layer). There is no `session:loaded` or `session:resumed` event defined in the ACP protocol.
- **Confirmed**: No
- **Notes**: This is an internal architecture concern (L1/L2 event bus), not an ACP wire protocol requirement.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `SessionManager.load()` returns data without emitting events on the internal EventBus. By comparison, `create()` and `destroy()` do emit `session:created` and `session:destroyed` events.
- **Issue Confirmed**: Yes — there is an inconsistency in the internal event model. `create()` emits events but `load()` does not.

## Verdict
NOT_ACP_ISSUE

## Remediation Steps
This is a code quality issue, not an ACP compliance issue. If desired:
1. Add `this._eventBus.emit('session:loaded', { sessionId })` after successful load in `SessionManager.load()`
2. This would allow internal subscribers (analytics, logging) to react to session resumptions
