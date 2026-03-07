# ISS-069: WRFC tool_call updates use wrong status values

**Severity**: Major
**File**: src/main.ts
**Line(s)**: 276-284
**Topic**: Implementation Guide

## Issue Description
WRFC tool_call updates use `'in_progress'` status instead of spec-mandated two-step `pending` then `running`. Emits only a single update with `'in_progress'`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/10-implementation-guide.md, lines 341-374
- **Spec Says**: WRFC phases map to ACP tool_call sequences: `pending -> running -> completed`. The initial `tool_call` update MUST have `status: 'pending'`. A separate `tool_call_update` transitions to `'running'` before execution begins.
- **Confirmed**: Yes
- **Notes**: The implementation guide explicitly shows: `status: 'pending'` on the initial `tool_call`, then a `tool_call_update` with `status: 'running'` before execution.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: At line 283, `toolCallEmitter.emitToolCall()` is called with status `'in_progress'` — a value that does not exist in the ACP spec's `ToolCallStatus` enum. The spec defines: `pending`, `running`, `completed`, `error`, `cancelled`. No `'in_progress'` value. Additionally, only one update is emitted per phase transition — no separate `pending` then `running` steps.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Change the initial `emitToolCall()` status from `'in_progress'` to `'pending'`
2. Add a second `emitToolCallUpdate()` call with `status: 'running'` before execution begins
3. Ensure the two-step sequence: `tool_call(pending)` -> `tool_call_update(running)` -> `tool_call_update(completed)`
4. Remove any usage of `'in_progress'` as it is not a valid ACP status value
