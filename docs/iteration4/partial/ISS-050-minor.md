# ISS-050: tool_call_update emits non-spec fields (rawOutput, toolName)

**Severity**: Minor  
**File**: `src/extensions/hooks/registrar.ts`  
**Lines**: 202-211  
**KB Reference**: KB-06 (Tool Calls)

## Description

The `tool:execute` post-hook emits a `tool:call:update` event on the internal EventBus that includes `rawOutput` and `toolName` fields, which are not part of the ACP `ToolCallStatusUpdate` schema.

## Source Evidence

`src/extensions/hooks/registrar.ts` lines 203-214:
```typescript
bus.emit('tool:call:update', {
  toolCallId,
  toolName,
  status: failed ? 'error' : 'completed',
  content: ...,
  rawOutput: result ?? null,
  _meta: ...,
});
```

Per KB-06, `ToolCallStatusUpdate` has fields: `sessionUpdate`, `toolCallId`, `status`, `content`, `locations`, `_meta`. The fields `rawOutput` and `toolName` are not in the spec.

Additionally, `status: 'error'` is used when the permission is denied, but the SDK defines `ToolCallStatus = "pending" | "in_progress" | "completed" | "failed"` -- `'error'` is not a valid status value.

## Analysis

This is an internal EventBus event (`tool:call:update`), not a direct wire-protocol message. It would only become an ACP compliance issue if this event is serialized to the wire without filtering out non-spec fields. The `status: 'error'` value is a separate concern (should be `'failed'`).

### Verdict: PARTIAL

The internal event contains non-spec fields and an invalid status value. While not directly serialized to the wire, the non-spec fields should be placed in `_meta` and the status should use `'failed'` instead of `'error'` to maintain consistency with the ACP spec vocabulary.

## Remediation

1. Move non-spec fields to `_meta`:
```typescript
bus.emit('tool:call:update', {
  toolCallId,
  status: failed ? 'failed' : 'completed',
  content: ...,
  _meta: {
    ...(failed ? { '_goodvibes/permissionReason': permissionReason } : {}),
    '_goodvibes/toolName': toolName,
    '_goodvibes/rawOutput': result ?? null,
  },
});
```

2. Change `'error'` to `'failed'` to match the ACP `ToolCallStatus` enum.
