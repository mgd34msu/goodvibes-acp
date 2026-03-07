# ISS-040: tool_call and tool_call_update missing optional content/locations/input fields

**Severity**: Major
**File**: src/extensions/acp/tool-call-emitter.ts
**Line(s)**: 42-47
**Topic**: Prompt Turn

## Issue Description
Missing `content`, `locations`, and `input` optional fields on emitted `tool_call`. `emitToolCallUpdate` is also missing `content` and `locations`. Add optional parameters for all three.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/04-prompt-turn.md, lines 142-215
- **Spec Says**: The `tool_call` initial announcement interface shows: `toolCallId`, `title`, `kind`, `status: "pending"` — no `content`, `locations`, or `input` fields. For `tool_call_update`, the spec shows `content?: ToolCallContent[]` as optional (present on completed/error). The `locations` and `input` fields are NOT present in the KB spec documentation.
- **Confirmed**: Partial
- **Notes**: The `content` field on `tool_call_update` is confirmed in the spec. However, `locations` and `input` fields are not documented in the KB. They may exist in the SDK types but are not part of the documented wire protocol in the knowledge base. The initial `tool_call` does not specify `content`, `locations`, or `input` in the spec.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `emitToolCall()` at lines 42-47 constructs `ToolCall` with `toolCallId`, `title`, `status`, and optional `_meta`. No `content`, `locations`, or `input`. `emitToolCallUpdate()` at lines 69-73 constructs `ToolCallUpdate` with `toolCallId`, `status`, and optional `_meta`. No `content`.
- **Issue Confirmed**: Partial — `content` on `tool_call_update` is a valid gap. `locations` and `input` are not confirmed in spec.

## Verdict
PARTIAL

## Remediation Steps
1. Add optional `content?: acp.ToolCallContent[]` parameter to `emitToolCallUpdate()` for completed/error status updates
2. Include `content` in the `ToolCallUpdate` object when provided
3. For `locations` and `input`: verify against the actual ACP SDK TypeScript types before adding — these fields are not documented in the KB
4. If SDK types include these fields, add them as optional parameters; otherwise, omit
