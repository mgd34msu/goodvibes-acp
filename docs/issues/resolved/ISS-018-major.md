# ISS-018 — PermissionGate Not Wired Into Tool Execution Lifecycle

**Severity**: Major
**File**: src/extensions/acp/permission-gate.ts:122-128
**KB Topic**: Integration (05-permissions.md lines 185-197)

## Original Issue
`PermissionGate` is not instantiated or wired into the agent tool-execution lifecycle. Permission checks are never enforced at runtime.

## Verification

### Source Code Check
At `permission-gate.ts:122-128`, the class documentation states:
```typescript
/**
 * @integration ISS-016 — This class must be wired into the agent tool-execution
 * lifecycle (hooks/registrar.ts) so that `check()` is called before each tool
 * invocation.  Until that wiring exists, permission checks are never enforced.
 *
 * @todo ISS-015 — PermissionGate is not yet instantiated or used.  Wire it into
 * the agent lifecycle via hooks/registrar.ts before shipping.
 */
export class PermissionGate {
```
The code itself acknowledges via `@todo` and `@integration` tags that it is dead code — not instantiated or integrated.

### ACP Spec Check
KB-05 (permissions.md lines 31-43) describes the permission flow:
```
1. LLM decides to call a tool
2. Agent reports tool_call (status: "pending")
3. Agent evaluates if this tool requires permission
4. If yes → Agent sends session/request_permission (BLOCKS)
5a. Granted → Agent reports tool_call_update (status: "running"), executes tool
5b. Denied → Agent reports tool_call_update (status: "failed"), reason: permission denied
```

Permissions are a core part of the ACP tool execution lifecycle. Without them wired in, sensitive operations execute unconditionally without user approval.

### Verdict: CONFIRMED
The code explicitly documents that `PermissionGate` is not wired into the tool execution lifecycle. The `@todo` comments confirm this is known dead code. The ACP spec requires permission gating before tool execution. Without this integration, the entire ACP permission system is non-functional.

## Remediation
1. Instantiate `PermissionGate` during agent/connection setup (in `main.ts` or the agent factory)
2. Wire `PermissionGate.check()` into the tool execution hook chain in `hooks/registrar.ts`
3. Ensure the check runs before every tool invocation and blocks execution until the client responds
4. Handle the permission denied case by emitting `tool_call_update` with status `'error'` and appropriate error content
5. Handle the cancellation case by emitting `tool_call_update` with status `'cancelled'`
