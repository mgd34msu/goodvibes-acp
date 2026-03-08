# ISS-100 — `Config.notifyChange` swallows listener errors

**Severity**: Minor  
**File**: `src/core/config.ts`  
**Lines**: 333-338  
**KB Reference**: None (internal quality concern)

## Description

Listener errors in `_notifyChange` are caught and logged to `console.error` but not propagated. A failing config change listener could silently break functionality with only stderr evidence.

### Verdict: NOT_ACP_ISSUE

This is an internal configuration management concern. The ACP spec does not define requirements for agent-internal config listener error handling. The errors are logged to `console.error` (not silently swallowed -- the issue description is slightly inaccurate). The catch-and-log pattern protects notification iteration from being aborted by a single failing listener, which is standard defensive practice. The issue references "KB-00: Error Handling" which does not exist.

## Remediation

Optional improvement:

1. Emit config listener failures through the EventBus for structured observability.
2. Consider using structured logging instead of `console.error`.
