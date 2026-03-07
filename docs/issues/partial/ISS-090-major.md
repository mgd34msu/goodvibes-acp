# ISS-090: emitToolCall accepts name parameter but never includes it in tool_call update

**Severity**: Major
**File**: src/extensions/acp/tool-call-emitter.ts
**Line(s)**: 31, 37
**Topic**: Tools & MCP

## Issue Description
`emitToolCall` accepts `name` parameter but never includes it in the `tool_call` update. `name` is silently dropped. Include `name` or remove the parameter.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/06-tools-mcp.md lines 91-100
- **Spec Says**: The `ToolCallUpdate` interface defines: `toolCallId` (string), `title` (string), `kind?` (ToolCallKind), `status?` (ToolCallStatus), `content?` (ContentBlock[]), `locations?` (FileLocation[]), `input?` (unknown), `_meta?` (Record<string, unknown>). There is NO `name` field in the spec's `ToolCallUpdate` interface.
- **Confirmed**: Partial
- **Notes**: The ACP spec does not define a `name` field on tool_call updates. However, the parameter is accepted and silently dropped, which is misleading API design. The `name` could be included via `_meta` or the parameter should be removed.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `emitToolCall()` at line 37 accepts `name: string` as its third parameter. The `toolCall` object constructed at lines 42-47 includes only `toolCallId`, `title`, `status`, and optionally `_meta`. The `name` parameter is never referenced after the function signature -- it is completely ignored.
- **Issue Confirmed**: Yes -- the parameter is accepted but dropped.

## Verdict
PARTIAL

## Remediation Steps
1. Option A: Remove the `name` parameter since the ACP spec does not define a `name` field on `ToolCallUpdate`
2. Option B: Include `name` in the `_meta` payload (e.g., `_meta: { ...meta, '_acp/tool_name': name }`) for client-side tool identification
3. Option C: If a future spec revision adds `name`, include it directly in the update object
4. Update all callers to match whichever option is chosen
