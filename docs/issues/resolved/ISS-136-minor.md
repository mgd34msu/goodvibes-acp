# ISS-136 — Registry Key Uses kebab-case Instead of snake_case

**Severity**: Minor
**File**: src/main.ts
**KB Topic**: Implementation Guide

## Original Issue
Registry key `'agent-spawner'` uses kebab-case. Spec uses snake_case: `'agent_spawner'`.

## Verification

### Source Code Check
The key `'agent-spawner'` appears in multiple places:
- `src/extensions/agents/coordinator.ts` line 23: `const AGENT_SPAWNER_KEY = 'agent-spawner';`
- `src/main.ts` line 125 (area): `registry.unregister('agent-spawner');` and `registry.register('agent-spawner', ...)`

The key is consistently kebab-case throughout the codebase.

### ACP Spec Check
The ACP spec and implementation guide KB (`10-implementation-guide.md`) do not define a specific naming convention for internal registry keys. The implementation guide discusses registry patterns in the context of the L1/L2/L3 layering but does not mandate snake_case vs kebab-case for registry key identifiers. This is an internal code convention, not an ACP wire format requirement.

### Verdict: NOT_ACP_ISSUE
The issue is real as a code style inconsistency — `'agent-spawner'` is kebab-case while other registry keys in the codebase may use different conventions. However, registry keys are internal identifiers not transmitted over the ACP wire protocol. The ACP spec does not specify naming conventions for internal registry keys. This is a code style issue.

## Remediation
If a project-wide convention of snake_case for registry keys is desired:
1. Update `AGENT_SPAWNER_KEY` constant in `src/extensions/agents/coordinator.ts` to `'agent_spawner'`.
2. Update all `registry.register('agent-spawner', ...)` and `registry.unregister('agent-spawner')` calls in `src/main.ts`.
3. Verify no other files reference the old key string.

This is a low-priority refactor with no functional impact on ACP compliance.
