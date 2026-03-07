# ISS-016: No permission-checking hooks exist for tool execution

**Severity**: Critical
**File**: src/extensions/hooks/built-ins.ts
**Line(s)**: 1-84 (entire file)
**Topic**: Permissions

## Issue Description
No permission-checking hooks exist. Spec requires a pre-hook on `tool:execute` that calls `PermissionGate.check()`. No hooks for `tool:call` or `tool:execute` events exist.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 186-197
- **Spec Says**: The permission flow requires that before tool execution, the agent evaluates whether permission is needed and gates the action. This implies a pre-execution checkpoint (hook) that performs the permission check.
- **Confirmed**: Yes
- **Notes**: While the spec does not literally say "implement a pre-hook", the permission flow described in the spec (evaluate -> request -> gate) naturally maps to a pre-execution hook pattern. The implementation has a hook system but uses it only for agent spawning and session lifecycle events, never for tool execution gating.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `built-ins.ts` contains five hook functions: `validateAgentConfig` (pre-hook for agent spawning), `emitAgentSpawned`, `emitWrfcReviewScore`, `emitWrfcCompleted`, `emitSessionCreated`, `emitSessionDestroyed`. All are agent/session/WRFC lifecycle hooks. Zero tool execution hooks. A grep for `tool:execute`, `tool:call`, and `permission` in the hooks directory returns zero matches.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
The hook system exists but has no tool execution hooks whatsoever. This is closely related to ISS-015 (PermissionGate unused). Without tool execution hooks, there is no integration point for permission checking in the runtime.

## Remediation Steps
1. Add a `checkToolPermission` pre-hook function that takes an EventBus and PermissionGate, checks permissions before tool execution
2. Register the hook on `tool:execute` or equivalent event in `HookRegistrar`
3. Ensure the hook blocks tool execution until permission is resolved (granted/denied)
4. Add a `emitToolExecuted` post-hook for audit logging of tool executions
