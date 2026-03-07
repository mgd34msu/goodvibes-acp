# ISS-065: validateAgentConfig doesn't check permission-related fields

**Severity**: Major
**File**: src/extensions/hooks/built-ins.ts
**Line(s)**: 18-28
**Topic**: Permissions

## Issue Description
`validateAgentConfig` doesn't check permission-related fields when spawning agents. Only validates `type`, `task`, and `sessionId`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 362-378
- **Spec Says**: Mode-based auto-approval is agent implementation detail. The mode determines whether `session/request_permission` is called. When spawning sub-agents, the parent's permission policy should propagate or be explicitly configured.
- **Confirmed**: Yes
- **Notes**: ACP spec doesn't explicitly mandate permission inheritance for sub-agents, but best practice requires that spawned agents operate under at least the same permission restrictions as the parent. Without validation, a sub-agent could bypass permission gates.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `validateAgentConfig` (lines 18-28) checks only three fields: `type`, `task`, `sessionId`. No check for `permissions`, `permissionPolicy`, `mode`, `allowedActions`, or any permission-related configuration. Returns `{ proceed: true }` if those three fields exist.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add permission-related field validation to `validateAgentConfig`
2. Check that spawned agent config includes `mode` or `permissionPolicy` from parent session
3. Consider adding `allowedActions` or `permissionPolicy` to the agent config type (`AgentConfig` in `src/types/agent.ts`)
4. At minimum, log a warning if no permission context is provided when spawning
