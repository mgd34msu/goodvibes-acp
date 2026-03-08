# ISS-074 — Missing error detail in `tool_call_update` for permission denial
**Severity**: Minor
**File**: `src/extensions/hooks/registrar.ts`
**KB Topic**: KB-05: Observability / KB-06: ToolCallStatusUpdate Schema

## Original Issue
When permission is denied, `reason` is a top-level field. ACP's `ToolCallStatusUpdate` does not have a `reason` field — error details should go in `content` or `_meta`.

## Verification

### Source Code Check
Lines 192-198 of `registrar.ts`:
```typescript
bus.emit('tool:call:update', {
  toolCallId,
  toolName,
  status: failed ? 'failed' : 'completed',
  output: result ?? null,
  reason: failed ? (meta._permissionReason as string | undefined) : undefined,
});
```
The emitted event includes `reason` and `output` as top-level fields, neither of which appear in the ACP `ToolCallStatusUpdate` schema.

### ACP Spec Check
KB-06 defines `ToolCallStatusUpdate` with these fields:
- `sessionUpdate: 'tool_call_update'`
- `toolCallId: string`
- `status?: ToolCallStatus`
- `content?: ContentBlock[]`
- `locations?: FileLocation[]`
- `_meta?: Record<string, unknown>`

There is no `reason` field and no `output` field. The spec uses `content` (ContentBlock array) for tool output and `_meta` for metadata.

KB-05 step 5b says: `tool_call_update (status: "failed"), reason: permission denied` — but this is a prose description of the semantic, not a schema field. The actual schema in KB-06 has no `reason` field.

### Verdict: CONFIRMED
The `reason` field is non-standard and does not exist in the `ToolCallStatusUpdate` schema. Additionally, `output` should be mapped to `content` as ContentBlock array. Permission denial reasons should go in `content` (as a text content block) or in `_meta`.

## Remediation
1. Replace `reason` with a `content` array containing a text content block: `[{ type: 'text', text: 'Permission denied: <reason>' }]`.
2. Replace `output` with `content` mapped to ContentBlock format.
3. Optionally include the raw reason in `_meta._goodvibes/permissionReason`.
