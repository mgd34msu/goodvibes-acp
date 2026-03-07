# ISS-089: All errors in _safeSessionUpdate silently swallowed

**Severity**: Major
**File**: src/extensions/acp/session-adapter.ts
**Line(s)**: 183-188
**Topic**: Sessions

## Issue Description
All errors in `_safeSessionUpdate` silently swallowed with empty `catch`. Makes debugging notification delivery failures impossible. Add conditional logging for non-connection-closed errors.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md
- **Spec Says**: The ACP spec does not prescribe internal error handling patterns for session update delivery. However, the spec does define session updates as notifications (fire-and-forget), which means some error swallowing is expected for closed connections.
- **Confirmed**: Partial
- **Notes**: While swallowing connection-closed errors is reasonable (notifications are fire-and-forget), swallowing ALL errors (including serialization errors, invalid state errors, etc.) hides real bugs.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 183-188 show `_safeSessionUpdate()` wraps `this.conn.sessionUpdate()` in a try/catch with a completely empty catch block (only a comment: "Connection may be closed -- swallow silently"). Every error type is swallowed: connection errors, serialization errors, invalid session ID errors, and programming errors alike.
- **Issue Confirmed**: Yes

## Verdict
PARTIAL

## Remediation Steps
1. Catch specific connection-closed error types and swallow only those
2. For other errors, log to stderr with session ID and update type for debugging
3. Consider: `catch (err) { if (!isConnectionClosed(err)) { console.error('sessionUpdate failed:', err); } }`
