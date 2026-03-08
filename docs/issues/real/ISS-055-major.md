# ISS-055 — MCP ToolCallStatus Uses 'in_progress' — Spec Says 'running'

**Severity**: Major
**File**: src/extensions/mcp/tool-call-bridge.ts:100
**KB Topic**: Tool Call Lifecycle / ToolCallStatus (06-tools-mcp.md line 114)

## Original Issue
The code uses `'in_progress'` for the running status while the KB defines the value as `'running'`.

## Verification

### Source Code Check
Line 100 (within the tool_start event handler):
```typescript
emitter.emitToolCallUpdate(sessionId, toolCallId, 'in_progress'),
```
The code emits `'in_progress'` as the tool call status when a tool begins execution.

### ACP Spec Check
KB-06 (line 114) explicitly defines:
```typescript
type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';
```
The valid active-execution status is `'running'`, not `'in_progress'`. There is no `'in_progress'` value in the ACP `ToolCallStatus` enum.

### Verdict: CONFIRMED
The code sends a status value (`'in_progress'`) that does not exist in the ACP `ToolCallStatus` type. Clients parsing this value according to the spec will not recognize it, potentially causing UI display issues or protocol errors.

## Remediation
1. Change `'in_progress'` to `'running'` at line 100:
   ```typescript
   emitter.emitToolCallUpdate(sessionId, toolCallId, 'running'),
   ```
2. Search for any other occurrences of `'in_progress'` used as a tool call status and replace them
3. If the ACP SDK itself uses `'in_progress'` internally, file an upstream issue or add a mapping layer
