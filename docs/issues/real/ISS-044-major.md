# ISS-044: MCP tool-call-bridge emits wrong initial status 'in_progress' instead of 'pending'

**Severity**: Major
**File**: src/extensions/mcp/tool-call-bridge.ts
**Line(s)**: 82
**Topic**: Tools & MCP

## Issue Description
Wrong initial status: emits `'in_progress'` on tool_start, skipping `'pending'`. Breaks permission-gated clients expecting `pending` before execution.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/06-tools-mcp.md, lines 88-114
- **Spec Says**: Initial `tool_call` update status defaults to `'pending'`. The valid `ToolCallStatus` values are `'pending' | 'running' | 'completed' | 'failed'`. There is no `'in_progress'` value in the spec. The lifecycle is: `pending -> (permission gate) -> running -> completed|failed`.
- **Confirmed**: Yes
- **Notes**: The value `'in_progress'` does not exist in the ACP spec at all. The closest valid value would be `'running'`, but even that should not be the initial status — `'pending'` is required for the permission gate to work correctly.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 82 passes `'in_progress'` as the status parameter to `emitToolCall()`. The comment on line 27 even documents this as the intended behavior: `tool_start → tool_call (status: in_progress)`. This is a consistent but incorrect design choice.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Change line 82 from `'in_progress'` to `'pending'`.
2. Update the class documentation (lines 27-29) to reflect the correct lifecycle: `tool_start → tool_call (status: pending)`.
3. If the bridge is meant to skip the permission gate (tools already approved), add a separate `tool_call_update` with `status: 'running'` after the initial `tool_call` with `status: 'pending'`.
