# ISS-037: tool_call session update missing kind field

**Severity**: Major
**File**: src/extensions/acp/tool-call-emitter.ts
**Line(s)**: 42-52
**Topic**: Prompt Turn

## Issue Description
`tool_call` update missing `kind` field. Spec defines `kind: ToolCallKind` (`'read' | 'write' | 'run' | 'switch_mode' | 'other'`). Add `kind` parameter to `emitToolCall()` and include in payload.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/04-prompt-turn.md, lines 142-157
- **Spec Says**: The `tool_call` interface requires `kind: ToolCallKind` as a field: `{ sessionUpdate: "tool_call", toolCallId: string, title: string, kind: ToolCallKind, status: "pending" }`. `ToolCallKind = "read" | "write" | "run" | "switch_mode" | "other"`.
- **Confirmed**: Yes
- **Notes**: `kind` is a required field in the spec interface, not optional.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `emitToolCall()` constructs `toolCall` object at lines 42-47 with only `toolCallId`, `title`, `status`, and optional `_meta`. The `kind` field is completely absent. The method signature does not accept a `kind` parameter.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `kind: acp.ToolCallKind` parameter to `emitToolCall()` method signature
2. Include `kind` in the constructed `ToolCall` object
3. Update all callers to pass an appropriate `kind` value
4. Default to `'other'` if the kind cannot be determined
