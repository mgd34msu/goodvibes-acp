# ISS-074: No explicit ACP session cleanup in shutdown manager

**Severity**: Major
**File**: src/extensions/lifecycle/shutdown.ts
**Line(s)**: 1-119 (entire file)
**Topic**: Initialization

## Issue Description
No explicit ACP session cleanup. No ACP-specific shutdown handlers (closing sessions, sending shutdown notifications, draining JSON-RPC requests).

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/02-initialization.md; docs/acp-knowledgebase/01-overview.md (Protocol Lifecycle)
- **Spec Says**: The ACP protocol lifecycle shows a connection lifecycle from initialization through prompt turns. While the spec does not explicitly define a shutdown method, graceful connection teardown is implicit — agents should complete in-flight requests, send `finish` updates with appropriate `stopReason`, and close the connection cleanly.
- **Confirmed**: Partial
- **Notes**: ACP spec does not define an explicit `shutdown` method. However, best practice requires draining in-flight prompt turns (emitting `finish` with `stopReason: 'cancelled'`), closing active sessions, and cleanly closing the JSON-RPC transport.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: The `ShutdownManager` class manages generic shutdown handlers with layer ordering (L3->L2->L1). However, no ACP-specific handlers are registered anywhere — no handler for closing ACP sessions, no handler for sending `finish` notifications to connected clients, no handler for draining the JSON-RPC request queue. The `registerPlugin` method (line 87-96) hardcodes all plugins at L3 (300) with no customization.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Register an L2-level shutdown handler that iterates active sessions and emits `finish` with `stopReason: 'cancelled'` for any in-flight prompts
2. Add a handler that closes the ACP `AgentSideConnection` gracefully (await `conn.close()` or equivalent)
3. Consider adding a drain period where no new `session/prompt` requests are accepted but in-flight ones complete
4. The `registerPlugin` hardcoded L3 order issue is a separate concern (see ISS-085)
