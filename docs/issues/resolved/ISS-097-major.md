# ISS-097 — `description` field not passed in permission request to SDK

**Severity**: Major  
**File**: `src/extensions/acp/permission-gate.ts`  
**Lines**: 175-185  
**KB Reference**: KB-05 (Permissions, lines 96-103)

## Description

The ACP spec (KB-05) defines the permission object as requiring `type`, `title`, and `description` fields. The `PermissionRequest` type in `src/types/permissions.ts` includes a `description` field (line 69). However, `PermissionGate.check()` constructs the SDK request with only `toolCall.title` and never includes `request.description` anywhere in the payload.

The SDK uses an options-based model (`options: PermissionOption[], toolCall`) rather than the spec's `permission: { type, title, description }`. Even within this SDK model, the description should be included in the `toolCall` object or as a separate field for the client to display.

### Verdict: CONFIRMED

KB-05 explicitly requires `description: string` as a required field on the permission object (line 100: "Required: full detail of what will happen"). The code constructs the permission request without passing this field, meaning clients cannot show users what the action will do.

## Remediation

1. Include `description` in the toolCall object sent to the SDK:
   ```typescript
   const response = await this.conn.requestPermission({
     sessionId: this.sessionId,
     options: buildPermissionOptions(),
     toolCall: {
       toolCallId,
       title: request.title,
       description: request.description,  // Add this
       status: 'pending',
       rawInput: request._meta?.rawInput ?? null,
       ...(request._meta ? { _meta: request._meta } : {}),
     },
   });
   ```
2. If the SDK `toolCall` type does not accept `description`, add it to `_meta` as a structured fallback.
