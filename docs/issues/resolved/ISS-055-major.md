# ISS-055 — `AgentCoordinator` does not surface agent data via `_goodvibes/agents` extension method

**Severity**: Major
**File**: `src/extensions/agents/coordinator.ts`
**KB Topic**: KB-08: Extension Methods

## Original Issue
KB-08 defines a `_goodvibes/agents` extension request with a specific response schema. The `AgentCoordinator` and `AgentTracker` provide no method that returns data in the required wire format. `AgentMetadata` uses `spawnedAt` instead of spec-required `startedAt`, and lacks `score`, `minimumScore`, and `files` fields.

## Verification

### Source Code Check
`AgentCoordinator` (lines 38-190) exposes methods: `spawn`, `result`, `cancel`, `status`, `_getSpawner`, `_spawnNow`, `_drainQueue`. None of these returns data in the `_goodvibes/agents` response format.

`AgentMetadata` (src/types/agent.ts, lines 118-128) has:
```typescript
export type AgentMetadata = {
  id: string;
  type: AgentType;
  sessionId: string;
  task: string;
  status: AgentStatus;
  spawnedAt: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
};
```
It has both `spawnedAt` and optional `startedAt`, but lacks `score` and `files` fields.

### ACP Spec Check
KB-08 shows the `_goodvibes/agents` response format:
```json
{
  "agents": [
    { "id": "agent_001", "type": "engineer", "status": "running", "startedAt": 1772877914 },
    { "id": "agent_002", "type": "reviewer", "status": "completed", "score": 8.5 }
  ]
}
```
The response uses `startedAt` (not `spawnedAt`) and includes `score`.

### Verdict: CONFIRMED
No method in `AgentCoordinator` or `AgentTracker` produces the `_goodvibes/agents` wire format. The `AgentMetadata` type does have `startedAt` as an optional field (partially matching the issue's claim about field mismatch), but `score` is entirely absent. There is no mapping function to convert internal metadata to the KB-08 response schema.

## Remediation
1. Add a `toAcpAgentsResponse(sessionId: string)` method to `AgentCoordinator` or `AgentTracker`.
2. Map `AgentMetadata` fields to the KB-08 wire format: use `startedAt` (falling back to `spawnedAt`), include `score` if available.
3. Register a handler for the `_goodvibes/agents` extension request method that calls this mapping function.
