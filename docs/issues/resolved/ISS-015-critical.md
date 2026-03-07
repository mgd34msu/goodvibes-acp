# ISS-015: PermissionGate is never instantiated or used

**Severity**: Critical
**File**: src/extensions/acp/agent.ts
**Line(s)**: 1-462
**Topic**: Permissions

## Issue Description
`PermissionGate` is never instantiated or used. The `prompt()` method runs the WRFC loop with no permission checking. The issue recommends importing and integrating `PermissionGate` and checking permissions before tool execution.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 186-197
- **Spec Says**: Permissions gate tool execution. The typical sequence: (1) LLM decides to call a tool, (2) Agent reports tool_call pending, (3) Agent evaluates if tool requires permission, (4) If yes, Agent sends session/request_permission and blocks, (5a) Granted: execute, (5b) Denied: report failed. Permission checking is a core part of the ACP tool execution flow.
- **Confirmed**: Yes
- **Notes**: The spec makes permissions integral to tool execution. An agent that never checks permissions before tool execution is non-conformant for any mode that requires permission gating.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `agent.ts` imports from `config-adapter`, `errors`, `mcp/bridge`, `PlanEmitter`, `CommandsEmitter` but never imports `PermissionGate`. The `prompt()` method (lines 246-347) creates an AbortController, records history, runs `this.wrfc.run()`, and streams results. No permission checks anywhere in the flow. A grep for `PermissionGate` across all source files confirms it is only referenced in its own module (`permission-gate.ts`), its types file, and the barrel export (`acp/index.ts`). Zero usage.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
The PermissionGate class exists but is completely dead code. No tool execution in the entire runtime is gated by permissions. This means all modes (including restrictive ones like 'plan' and 'sandbox') execute tools without any user approval, violating the ACP permission model.

## Remediation Steps
1. Import `PermissionGate` and `MODE_POLICIES` in `agent.ts`
2. Instantiate a `PermissionGate` per session with the appropriate policy for the session's mode
3. Pass the `PermissionGate` instance to the WRFC runner or hook it into the tool execution pipeline
4. Before each tool execution, call `permissionGate.check()` and respect the result
5. Update the WRFC runner interface to accept a permission checking callback
