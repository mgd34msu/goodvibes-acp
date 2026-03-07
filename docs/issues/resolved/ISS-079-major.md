# ISS-079: Agent spawn doesn't capture filesModified — array always empty

**Severity**: Major
**File**: src/plugins/agents/spawner.ts
**Line(s)**: 94-210
**Topic**: Implementation Guide

## Issue Description
Agent spawn doesn't capture `filesModified`. Array initialized empty, never populated. ACP clients cannot display changed files.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/10-implementation-guide.md, Section 6 (WRFC as Tool Calls)
- **Spec Says**: The implementation guide shows `tool_call_update` for completed work phases including `locations: workResult.filesModified.map(f => ({ path: f }))` and `_meta: { '_goodvibes/files': workResult.filesModified }`. ACP clients use `locations` to display which files were modified during the work phase.
- **Confirmed**: Yes
- **Notes**: Without populated `filesModified`, the `locations` array in tool_call_update is always empty, and clients cannot show users which files the agent changed.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 112: `filesModified: []` initialized as empty array in `AgentState`. The `_settleFromLoop` method and `_complete` method never assign to `state.filesModified`. The `AgentLoop` class (loop.ts) does not track or return file modifications either. The `AgentResult` type likely includes `filesModified` but it's always `[]`.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. In `AgentLoop`, track file write operations by hooking into `precision_write` and `precision_edit` tool results
2. When tools complete, parse their results for file paths and accumulate in a `filesModified` set
3. Return `filesModified` in `LoopResult` and populate `state.filesModified` in `_settleFromLoop`
4. Alternatively, use the EventBus to listen for `file:written` events and associate them with the agent's session
