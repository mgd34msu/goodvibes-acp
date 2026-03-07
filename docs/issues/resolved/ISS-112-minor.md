# ISS-112 — toolCallId in Permission Request Doesn't Match Emitted tool_call Update

**Severity**: Minor
**File**: src/extensions/acp/permission-gate.ts:136
**KB Topic**: Permissions

## Original Issue

**[src/extensions/acp/permission-gate.ts:136]** `toolCallId` construction (`request.toolName ?? 'permission-${type}'`) doesn't follow spec. `toolCallId` should match the `tool_call` update sent before the request. Require caller to pass the actual `toolCallId`. *(Permissions)*

## Verification

### Source Code Check

`permission-gate.ts` line 136:

```typescript
const toolCallId = request.toolName ?? `permission-${type}`;
const response = await this.conn.requestPermission({
  sessionId: this.sessionId,
  options: buildPermissionOptions(),
  toolCall: {
    toolCallId,
    title: request.title,
    status: 'pending',
    rawInput: request.arguments ?? null,
    ...(request._meta ? { _meta: request._meta } : {}),
  },
});
```

The `toolCallId` is constructed from `request.toolName` (if present) or falls back to the synthetic `'permission-${type}'` string. `request.toolName` is a string (the tool's name), not an actual `toolCallId` UUID. The `PermissionRequest` type does not include a `toolCallId` field, so the caller cannot supply the actual ID.

Additionally, this code uses `buildPermissionOptions()` and the `options`-based format — confirmed problematic by ISS-13 (Critical, options-based format doesn't exist in ACP spec). But putting that aside to focus on the toolCallId issue specifically:

### ACP Spec Check

KB `05-permissions.md` at the bottom:

> `toolCallId` used in permission context should match the `tool_call` update sent before the request.

The canonical sequence from the KB:
```
1. LLM decides to call a tool
2. Agent reports tool_call (status: "pending")  ← toolCallId generated here
3. Agent evaluates if this tool requires permission
4. If yes → Agent sends session/request_permission (BLOCKS)
```

The `toolCallId` in the permission request should be the same UUID used in step 2's `tool_call` update. The current implementation manufactures a new ID from the tool name, breaking the linkage.

Note: The spec's wire format for `session/request_permission` params is:
```json
{ "sessionId": "...", "permission": { "type": "shell", "title": "...", "description": "..." } }
```
The `toolCallId` is not actually a field in the spec's `session/request_permission` params — it belongs to the preceding `tool_call` update. The options/toolCall format used here (ISS-13) is non-spec anyway.

### Verdict: CONFIRMED

The issue is real. Even within the implementation's own options-based permission format, the `toolCallId` is constructed from the tool name rather than the actual UUID emitted in the `tool_call` update. This breaks the linkage between the permission request and the tool call visible in the client UI.

## Remediation

1. Add `toolCallId?: string` to the `PermissionRequest` type in `src/types/permissions.ts`.
2. Update `PermissionGate.check()` to use `request.toolCallId` when present, falling back to a generated UUID (not the tool name):
   ```typescript
   const toolCallId = request.toolCallId ?? randomUUID();
   ```
3. Callers (tool execution layer) must pass the actual `toolCallId` that was emitted in the preceding `tool_call` update.
4. Long-term: resolve ISS-13 (replace options-based format with spec `permission: { type, title, description }`).
