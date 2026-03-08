# ISS-078 — Permission gate is a TODO placeholder
**Severity**: Minor
**File**: `src/extensions/mcp/tool-call-bridge.ts`
**KB Topic**: KB-06: Tool Permissions

## Original Issue
The permission gate flow is described but not implemented. All tools transition from pending to in_progress without any permission check. Destructive operations (file writes, shell commands) should request permission.

## Verification

### Source Code Check
Lines 101-108 of `tool-call-bridge.ts`:
```typescript
// TODO(ISS-024): Permission gate — between pending and in_progress, check if
// this tool requires user approval (e.g. file writes, shell commands). When
// ISS-018 (PermissionGate wiring) is resolved, call:
//   const { granted } = await connection.requestPermission({ sessionId,
//     permission: { type: inferPermissionType(event.toolName),
//                   title: title, description: JSON.stringify(event.input) } })
//   if (!granted) { emitToolCallUpdate(sessionId, toolCallId, 'failed',
//     undefined, [{ type:'content', content:{ type:'text', text:'Permission denied' } }]) }
```
The permission gate is entirely a TODO comment. Line 109 immediately transitions to `in_progress` without any check.

### ACP Spec Check
KB-06 defines the tool call lifecycle as:
```
pending → (optional permission gate) → running → completed|failed
```
KB-05 defines the permission flow where the agent should call `session/request_permission` for tools requiring user approval. The permission gate is optional per spec but recommended for destructive operations.

### Verdict: CONFIRMED
The permission gate in the MCP tool call bridge is documented as a known gap (ISS-024). All tool calls bypass permission checks and go directly from pending to in_progress. This is a functional gap for security-sensitive operations. Note: the HookRegistrar (ISS-018) has a separate permission gate implementation for hook-based tool execution, but the MCP bridge path lacks it.

## Remediation
1. Implement the permission gate per ISS-024 when PermissionGate wiring (ISS-018) is complete.
2. Use `inferPermissionType` to determine which tools require permission (file writes, shell commands).
3. Call `session/request_permission` and handle denial by emitting `tool_call_update(status: 'failed')`.
