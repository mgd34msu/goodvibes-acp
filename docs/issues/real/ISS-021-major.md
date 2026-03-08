# ISS-021 — `tool:execute` Pre-Hook Is a TODO Stub — Always Returns `_permissionChecked: true`

**Severity**: Major
**File**: src/extensions/hooks/registrar.ts:111-120
**KB Topic**: Overview — Permissions (session/request_permission) (01-overview.md lines 147, 224)

## Original Issue
The `tool:execute` pre-hook is a placeholder that always sets `_permissionChecked: true` without calling `PermissionGate.check()` or any actual permission evaluation. ACP has a native `session/request_permission` flow where the agent presents permission requests. A hook that always returns `_permissionChecked: true` without any check implies permissions are enforced when they are not.

## Verification

### Source Code Check
Lines 111-117 of `registrar.ts`:
```typescript
engine.register(
  'tool:execute',
  'pre',
  async (context: Record<string, unknown>) => {
    // TODO: Wire PermissionGate.check() here when permission system is activated
    // For now, always allow (no permission gate instantiated yet — see ISS-015)
    return { ...context, _permissionChecked: true };
  },
  100
);
```
The hook is explicitly a TODO stub that unconditionally sets `_permissionChecked: true`. The TODO comment references ISS-015, confirming the permission gate is not yet wired.

### ACP Spec Check
KB-01 (01-overview.md line 224) lists `session/request_permission` as a baseline client method: "Present permission request to user, return grant/deny." KB-05 (05-permissions.md) defines the full wire format with `permission.type`, `title`, and `description` fields. The ACP protocol expects agents to request permission before executing sensitive tool operations.

KB-06 (06-tools-mcp.md lines 497-514) shows the tool lifecycle should include an optional permission gate between `pending` and `running` states.

### Verdict: CONFIRMED
The code is an explicit placeholder stub with a TODO comment. It unconditionally grants permission without any actual check, bypassing the ACP `session/request_permission` flow entirely. This is not speculative — the code itself admits it is unimplemented.

## Remediation
1. Instantiate `PermissionGate` and inject it into the hook registrar
2. In the `tool:execute` pre-hook, call `PermissionGate.check(toolName, toolInput)` to evaluate whether the tool requires permission
3. For tools requiring permission, call `connection.requestPermission()` with the proper `permission` object (`type`, `title`, `description`)
4. Block tool execution until the permission response is received
5. If denied, return a context with `_permissionDenied: true` and abort the tool call with `status: 'failed'`
