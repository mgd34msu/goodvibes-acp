# ISS-019 — tool_call_update event payload does not match ACP ToolCallStatusUpdate schema

**Severity**: Major
**File**: src/extensions/hooks/registrar.ts
**KB Topic**: KB-04/KB-06: Schema Mismatch

## Original Issue
The emitted event uses `output` as a raw field, but ACP's `ToolCallStatusUpdate` specifies `content?: ContentBlock[]`. The event also omits `sessionUpdate: 'tool_call_update'` discriminator. When mapped to a `session/update` notification, the shape will be wrong.

## Verification

### Source Code Check
At lines ~192-198 of `src/extensions/hooks/registrar.ts`:
```typescript
bus.emit('tool:call:update', {
  toolCallId,
  toolName,
  status: failed ? 'failed' : 'completed',
  output: result ?? null,
  reason: failed ? (meta._permissionReason as string | undefined) : undefined,
});
```
The event uses `output` (raw value) rather than `content: Array<ToolCallContent>`, and lacks the `sessionUpdate: 'tool_call_update'` discriminator.

### ACP Spec Check
The SDK's `ToolCallUpdate` type uses `content?: Array<ToolCallContent> | null` for tool output, not a raw `output` field. It also has optional fields like `rawOutput?: unknown`. The `sessionUpdate: 'tool_call_update'` discriminator is added at the `SessionUpdate` union level.

However, this is an **internal EventBus event** (`tool:call:update`), not a direct ACP wire message. It is emitted on the internal `bus` object. The translation to ACP wire format would happen at a higher layer when converting this event into a `session/update` notification.

### Verdict: PARTIAL
The event payload shape does diverge from the ACP `ToolCallUpdate` schema — using `output` instead of `content: ToolCallContent[]` and including non-spec fields like `toolName` and `reason`. However, this is an internal EventBus event, not directly sent over the ACP wire. The issue is valid in that the internal representation should ideally mirror the ACP schema to simplify wire mapping, but it overstates the compliance impact since the translation layer could handle the mapping.

## Remediation
1. Replace `output: result` with `content: [{ type: 'content', content: { type: 'text', text: String(result) } }]` to match `ToolCallContent[]` shape.
2. Or use `rawOutput: result` which is a recognized field on `ToolCallUpdate`.
3. Move `reason` into `_meta` if it needs to be preserved.
4. Add `sessionUpdate: 'tool_call_update'` if this event is intended to be directly forwarded as a session update.
