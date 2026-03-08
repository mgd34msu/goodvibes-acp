# ISS-022 — MCP Tool Call `kind` Always `'other'` — Should Be Inferred from Tool Name

**Severity**: Major
**File**: src/extensions/mcp/tool-call-bridge.ts:96
**KB Topic**: Tool Call Kind Reference (06-tools-mcp.md lines 144-155, 491)

## Original Issue
Every MCP tool call is announced with `kind: 'other'` regardless of function. The spec shows `kind: inferKind(toolName)` should be used. Defaulting all tools to `'other'` prevents clients from using kind for icon/display selection.

## Verification

### Source Code Check
Line ~96 of `tool-call-bridge.ts` (in the `emitToolCall` call):
```typescript
emitter
  .emitToolCall(
    sessionId,
    toolCallId,
    event.toolName,
    title,
    'other',  // <-- hardcoded
    { '_goodvibes/turn': event.turn },
  )
```
The `kind` parameter is hardcoded to `'other'` for every tool call regardless of the tool name.

### ACP Spec Check
KB-06 (06-tools-mcp.md) defines `ToolCallKind` with values: `read`, `edit`, `delete`, `move`, `search`, `execute`, `think`, `fetch`, `other`. Line 491 shows the reference implementation using `kind: inferKind(toolName)` to map tool names to appropriate kinds (e.g., `read_file` -> `'read'`, `write_file` -> `'edit'`, shell commands -> `'execute'`).

The Kind Reference table (lines 144-155) maps kinds to use cases and icon hints, confirming that clients rely on this value for display purposes.

### Verdict: CONFIRMED
The code hardcodes `'other'` for all tool calls. The ACP spec explicitly shows that `kind` should be inferred from the tool name. This prevents clients from displaying appropriate icons and categorizing tool operations.

## Remediation
1. Implement an `inferKind(toolName: string): ToolCallKind` function that maps MCP tool names to ACP kinds:
   - Tools containing `read` or `get` -> `'read'`
   - Tools containing `write`, `create`, `edit`, `update`, `patch` -> `'edit'`
   - Tools containing `delete`, `remove` -> `'delete'`
   - Tools containing `move`, `rename` -> `'move'`
   - Tools containing `search`, `grep`, `glob`, `find` -> `'search'`
   - Tools containing `exec`, `run`, `shell`, `bash` -> `'execute'`
   - Tools containing `fetch`, `http`, `request` -> `'fetch'`
   - Default -> `'other'`
2. Replace the hardcoded `'other'` in `emitToolCall` with `inferKind(event.toolName)`
