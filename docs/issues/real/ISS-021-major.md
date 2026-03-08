# ISS-021 — MCP permission gate is a TODO placeholder

**Severity**: Major
**File**: `src/extensions/mcp/tool-call-bridge.ts`
**Lines**: 101-108
**KB Reference**: KB-06 (MCP Tools)

## Description

KB-06 defines a mandatory permission gate between the `pending` and `running` (in_progress) tool call states for tools with side effects. The implementation contains only a TODO comment (referencing ISS-024/ISS-018) at lines 101-108 with a sketch of what the permission gate should look like, but no actual permission check is performed. All tools immediately transition from pending to in_progress without any permission gating.

### Verdict: CONFIRMED

The source code at lines 101-108 explicitly shows a TODO comment describing the permission gate requirement with no implementation. KB-06 section on permission gating (lines 498, 160) clearly mandates this step.

## Remediation

1. Implement `requiresPermission(toolName)` check between the `pending` emit and the `in_progress` transition
2. Call `connection.requestPermission()` for tools that require user approval
3. On denial, emit `tool_call_update` with `status: 'failed'` and a "Permission denied" content block
4. On approval, proceed with the existing `in_progress` transition
5. Coordinate with ISS-018 (PermissionGate wiring) for the ACP connection plumbing
