# ISS-009 — `description` field lost in SDK permission request construction
**Severity**: Critical
**File**: `src/extensions/acp/permission-gate.ts`
**KB Topic**: KB-05: Permissions

## Original Issue
`buildPermissionRequest()` constructs the SDK `toolCall` object but never passes `request.description`. ACP requires `description` as mandatory on the Permission object. The client has no way to show the user what action is being gated.

## Verification

### Source Code Check
`src/extensions/acp/permission-gate.ts` lines 137-149 (`buildPermissionRequest`):
```
return {
  sessionId,
  options: buildPermissionOptions(),
  toolCall: {
    toolCallId,
    title: request.title,
    status: 'pending',
    rawInput: request._meta?.rawInput ?? null,
    ...(request._meta ? { _meta: request._meta } : {}),
  },
};
```

The `request.description` is not included in the `toolCall` object.

### ACP Spec Check
SDK `RequestPermissionRequest` (types.gen.d.ts:1887-1910) uses:
```
toolCall: ToolCallUpdate;
```

SDK `ToolCallUpdate` (types.gen.d.ts:2972-3015) has fields: `_meta`, `content`, `kind`, `locations`, `rawInput`, `rawOutput`, `status`, `title`, `toolCallId`. There is NO `description` field on `ToolCallUpdate`.

However, KB-06 wire spec shows a different format:
```
permission: { type, title, description }
```

The SDK and wire spec diverge on the permission request shape.

### Verdict: PARTIAL
The SDK's `ToolCallUpdate` type (used as `toolCall` in `RequestPermissionRequest`) has no `description` field. The code correctly follows the SDK API. However, the KB-06 wire spec does define `description` as part of the permission request. The `title` field is passed and provides some context, but the richer `description` (which the `PermissionRequest` type does carry) is not forwarded via any available mechanism. The client loses the detailed action description.

## Remediation
1. Pass `request.description` as part of `_meta` on the toolCall object (e.g., `_meta: { '_goodvibes/description': request.description }`) until the SDK adds a `description` field.
2. Alternatively, embed the description in the `title` field if it's short enough.
3. Track SDK evolution — when the SDK aligns with the wire spec's `description` field, use it directly.
