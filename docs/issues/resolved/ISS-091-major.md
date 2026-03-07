# ISS-091: activeIds keyed by tool name causes concurrent same-tool call collision

**Severity**: Major
**File**: src/extensions/mcp/tool-call-bridge.ts
**Line(s)**: 70
**Topic**: Tools & MCP

## Issue Description
`activeIds` keyed by tool name — concurrent same-tool calls overwrite each other's tracking state.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 06-tools-mcp.md, lines 570-585; agentclientprotocol.com architecture
- **Spec Says**: "The spec does not prohibit concurrent tool calls. When the LLM requests multiple tool uses in the same response, the agent may report multiple `tool_call` updates with distinct `toolCallId` values, then update each independently." Each `toolCallId` must be unique within a session.
- **Confirmed**: Yes
- **Notes**: The spec explicitly supports parallel tool calls with distinct toolCallIds. Keying by tool name rather than a unique invocation identifier violates this.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 62: `const activeIds = new Map<string, string>();` — keyed by tool name string. Line 70: `activeIds.set(event.toolName, toolCallId);`. When two concurrent calls to the same tool (e.g., two parallel `read_file` calls) occur, the second `set()` overwrites the first's toolCallId, causing the first call's `tool_end` event to update the wrong (second) toolCallId.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Change the Map key from tool name to a unique invocation identifier (e.g., use the `toolCallId` itself as key, or use a composite key like `${toolName}:${turn}:${index}`).
2. Alternative: Change `activeIds` to a `Map<string, string[]>` (tool name to array of toolCallIds) with LIFO/FIFO matching on `tool_end`.
3. If the upstream `AgentProgressEvent` includes a unique invocation ID, use that as the key instead.
