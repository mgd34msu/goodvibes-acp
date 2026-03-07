# ISS-045: MCP tool-call-bridge missing content field on completed/failed updates

**Severity**: Major
**File**: src/extensions/mcp/tool-call-bridge.ts
**Line(s)**: 94-101
**Topic**: Tools & MCP

## Issue Description
`emitToolCallUpdate` for completed/failed missing `content` field. Only sends `_meta` with duration/error — no `ContentBlock[]`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/06-tools-mcp.md, lines 119-128, 525-534
- **Spec Says**: `tool_call_update` includes an optional `content?: ContentBlock[]` field for tool output. The MCP-to-ACP bridging example (lines 525-534) shows forwarding MCP `content` blocks directly: `content: mcpResult.content`. The spec states "MCP ContentBlock[] is directly compatible with ACP" (line 540).
- **Confirmed**: Yes
- **Notes**: While `content` is optional in the type definition, the spec examples consistently include it for completed/failed updates. Omitting it means clients cannot display tool output.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 94-101 call `emitToolCallUpdate` with only `status: 'completed'` and `_meta: { '_goodvibes/durationMs': event.durationMs }`. No `content` field is passed. Similarly, lines 110-116 for failed status only pass `_meta: { '_goodvibes/error': event.error }` with no content blocks. The `AgentProgressEvent` type likely contains the tool result but it's not forwarded.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `content` parameter to `emitToolCallUpdate` calls for both completed and failed cases.
2. For completed: extract tool output from `event` and format as `ContentBlock[]` (e.g., `[{ type: 'text', text: event.result }]`).
3. For failed: include error information as content: `[{ type: 'text', text: event.error }]`.
4. Optionally add `locations` if the tool operation affects specific files.
