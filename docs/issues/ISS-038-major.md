# ISS-038: Initial tool_call status not enforced as pending

**Severity**: Major
**File**: src/extensions/acp/tool-call-emitter.ts
**Line(s)**: 34-39
**Topic**: Prompt Turn

## Issue Description
Initial `tool_call` status should always be `"pending"`. Method accepts any `ToolCallStatus`, allowing non-conforming initial values like `'in_progress'`. Hardcode or validate status to `'pending'` for initial announcements.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/04-prompt-turn.md, lines 148
- **Spec Says**: The initial `tool_call` announcement interface specifies `status: "pending"` — it is always `"pending"` on initial announcement. The status lifecycle is: `pending` -> `in_progress` -> `completed` | `cancelled` | `error`.
- **Confirmed**: Yes
- **Notes**: The spec interface shows `status: "pending"` as a literal type, not `ToolCallStatus`. Initial announcements must always be pending.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `emitToolCall()` at line 39 accepts `status: acp.ToolCallStatus` as a parameter, which allows any status value including `'in_progress'`, `'completed'`, `'error'`, etc. There is no validation or hardcoding to enforce `'pending'`.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Remove the `status` parameter from `emitToolCall()` or change its type to `'pending'` literal
2. Hardcode `status: 'pending'` in the constructed ToolCall object
3. Callers that need to set other statuses should use `emitToolCallUpdate()` instead
