# ISS-052: Permission type defaults to non-spec 'mcp'

**Severity**: Minor
**Category**: KB-05 Permissions
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 144-151

## Description

When `permissionType` is unset on a tool execution context, the code defaults to `'mcp'` — a non-standard permission type not defined in the ACP spec.

### Verdict: CONFIRMED

Source at lines 148-151 shows:
```typescript
if (!pt) {
  console.warn(`[HookRegistrar] tool:execute pre-hook: permissionType not set for tool '${tn}', defaulting to 'mcp'`);
}
return pt ?? 'mcp';
```
ACP-defined permission types (KB-05) are: `shell`, `file_write`, `file_delete`, `network`, `browser`. The bare `mcp` string is not ACP-defined and could collide with future spec additions. Defaulting to a non-standard type when unset means permission gate behavior is undefined from the ACP perspective.

## Remediation

1. Require `permissionType` to be set explicitly by callers, or derive it from the tool kind.
2. If a custom default is needed, namespace it as `_goodvibes/mcp` per ACP custom type convention.
3. Consider mapping MCP tool calls to appropriate ACP permission types based on the tool's behavior.

## ACP Reference

KB-05: Permission types are string values. Custom types should use `_` prefix to avoid collision with future spec-defined types.
