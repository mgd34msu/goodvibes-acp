# ISS-038: No `_goodvibes/agents` wire format adapter in agents plugin

**Severity**: Major
**Category**: KB-08 Extensibility
**File**: `src/plugins/agents/spawner.ts`
**Lines**: Entire file

## Description

KB-08 defines a `_goodvibes/agents` extension method with a specific wire format including fields like `completedAt`, `score`, and `minimumScore`. The spawner's `_buildResult()` returns `{ handle, status, output, filesModified, errors, durationMs }` — a different shape missing the KB-required fields.

### Verdict: CONFIRMED

Grep for `completedAt`, `minimumScore`, and `_goodvibes/agents` in spawner.ts returned zero matches. The `_buildResult()` method (lines 387-400) produces an internal `AgentResult` shape that does not include WRFC score data, completion timestamps in ISO format, or the minimum score threshold. No adapter method exists to transform this into the KB-08 wire format.

## Remediation

1. Add a `toWireFormat(result: AgentResult): GoodVibesAgentResponse` method that maps internal fields to the KB-08 shape.
2. Include `completedAt` (ISO timestamp from `state.finishedAt`), `score` (from WRFC review if available), `minimumScore` (from agent config threshold).
3. Register this adapter with the extensions handler for `_goodvibes/agents` method calls.

## ACP Reference

KB-08: `_goodvibes/agents` extension defines a specific response shape for agent status queries.
