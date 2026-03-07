# ISS-064: No tool lifecycle hooks registered

**Severity**: Major
**File**: src/extensions/hooks/registrar.ts
**Line(s)**: 47-108
**Topic**: Permissions

## Issue Description
No tool lifecycle hooks registered. Events system defines `tool:called` and `tool:executed` but `registerBuiltins()` registers zero hooks for these.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 186-197
- **Spec Says**: Permissions gate tool execution. The sequence is: (1) LLM decides to call tool, (2) agent reports `tool_call` pending, (3) agent evaluates if permission needed, (4) if yes, sends `session/request_permission`, (5) proceeds or aborts. A pre-hook on tool execution is the natural integration point for permission gating.
- **Confirmed**: Yes
- **Notes**: Without tool lifecycle hooks, there is no systematic point to inject permission checks before tool execution. Each call site must manually check permissions, which is error-prone.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `registerBuiltins()` (lines 47-108) registers hooks for: `agent:spawn` (pre+post), `wrfc:review` (post), `wrfc:complete` (post), `session:create` (post), `session:destroy` (post). Zero hooks for `tool:called`, `tool:executed`, or any tool-related event.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `tool:execute` pre-hook that calls `PermissionGate.check()` before tool execution
2. Add `tool:execute` post-hook that emits `tool_call_update` with completion status
3. Register both in `registerBuiltins()`
4. Ensure the hook receives sufficient context (tool name, arguments, session ID) for permission evaluation
