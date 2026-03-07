# ISS-017: AgentConfig carries no permission context

**Severity**: Critical
**File**: src/types/agent.ts
**Line(s)**: 33-48
**Topic**: Permissions

## Issue Description
`AgentConfig` carries no permission context. No `permissions`, `permissionPolicy`, `mode`, or `allowedActions` field. Spawned agents cannot know permission rules.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 362-378
- **Spec Says**: Mode-based auto-approval is agent implementation detail. The agent checks its current mode before deciding whether to request permission. The mode drives the permission policy (ask mode = always prompt, code mode = prompt for risky, yolo = skip). Spawned sub-agents need to inherit or be assigned a permission context to know how to gate their own tool execution.
- **Confirmed**: Yes
- **Notes**: The ACP spec itself does not define an "AgentConfig" type for spawned sub-agents, as sub-agent orchestration is implementation-specific. However, the permission model requires that any entity executing tools must know whether to gate them. Without permission context in AgentConfig, spawned agents have no way to determine their permission policy.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `AgentConfig` at lines 33-48 has fields: `type`, `task`, `sessionId`, `contextFiles?`, `model?`, `context?`, `timeoutMs?`. No field for permissions, permission policy, mode, or allowed actions. The `context` field (line 45) is a generic `Record<string, unknown>` that could theoretically carry permission data, but there is no typed field or contract for it.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
AgentConfig lacks any permission-related fields. Combined with ISS-015 and ISS-016, this means the entire permission system is disconnected: PermissionGate exists but is unused, hooks don't check permissions, and sub-agents have no permission context. This is a systemic gap.

## Remediation Steps
1. Add `mode?: string` field to `AgentConfig` so spawned agents inherit the session mode
2. Add `permissionPolicy?: PermissionPolicy` field for explicit permission rules
3. Alternatively, add `allowedActions?: PermissionType[]` for a simpler approach
4. Ensure the coordinator passes the session's current mode/policy to spawned agents
5. In the agent loop, use the permission context to instantiate a PermissionGate
