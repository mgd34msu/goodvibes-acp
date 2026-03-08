# ISS-049 — Agent Coordinator Uses Wrong Registry Key `'agent-spawner'` vs `'agent_spawner'`

**Severity**: Major
**File**: src/extensions/agents/coordinator.ts:23
**KB Topic**: Registry Key Naming (10-implementation-guide.md section 6, line 399)

## Original Issue
`AGENT_SPAWNER_KEY` is `'agent-spawner'` (hyphenated) but KB specifies `'agent_spawner'` (underscored). The coordinator cannot retrieve the spawner without a key translation layer.

## Verification

### Source Code Check
At line 23:
```typescript
/** Registry key used to look up the L3 IAgentSpawner implementation. */
const AGENT_SPAWNER_KEY = 'agent-spawner';
```
The key uses a hyphen (`agent-spawner`).

### ACP Spec Check
KB-10 (line 399) shows the spec-defined registry lookup:
```typescript
const spawner = this.registry.get<IAgentSpawner>('agent_spawner');
```
The key uses an underscore (`agent_spawner`).

### Verdict: CONFIRMED
The implementation uses `'agent-spawner'` (hyphenated) while the KB spec uses `'agent_spawner'` (underscored). If the spawner is registered with the spec-defined key `'agent_spawner'`, the coordinator's `registry.get('agent-spawner')` lookup will fail to find it, causing a runtime error when attempting to spawn agents.

## Remediation
1. Change the constant to match the spec:
```typescript
const AGENT_SPAWNER_KEY = 'agent_spawner';
```
2. Audit all other registry keys in the codebase for naming consistency.
3. Consider adding a registry key validation layer that catches mismatches early.
