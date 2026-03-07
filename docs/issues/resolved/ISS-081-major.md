# ISS-081: Immediate spawned-to-running transition with no pending state

**Severity**: Major
**File**: src/plugins/agents/spawner.ts
**Line(s)**: 118-119
**Topic**: Implementation Guide

## Issue Description
Immediate `spawned -> running` transition with no `pending` state. No window for L2 to emit ACP `pending` tool_call.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/10-implementation-guide.md lines 342-344
- **Spec Says**: Tool call lifecycle is `pending -> running -> completed`. Each WRFC phase maps to an ACP `tool_call` update sequence starting with `status: 'pending'`.
- **Confirmed**: Yes
- **Notes**: The spec explicitly shows `pending` as the initial status for tool_call updates. Skipping it means clients never see the pending state.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 119 sets `state.status = 'running'` synchronously immediately after creating the agent state. Comment on line 118 says "Transition to 'running' synchronously (mirrors real process start)". No intermediate `pending` state is ever set.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Initialize `state.status` to `'pending'` (or `'spawned'`) when creating the agent state object
2. Emit any ACP `tool_call` update with `status: 'pending'` before transitioning to `'running'`
3. Transition to `'running'` only after the agent loop or LLM provider is actually invoked
