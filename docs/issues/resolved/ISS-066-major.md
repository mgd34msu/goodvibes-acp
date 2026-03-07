# ISS-066: PermissionRequest lacks sessionId field

**Severity**: Major
**File**: src/types/permissions.ts
**Line(s)**: 40-53
**Topic**: Permissions

## Issue Description
`PermissionRequest` type lacks `sessionId` field. ACP wire format requires `sessionId` in every `session/request_permission` request.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 27-41
- **Spec Says**: Wire format for `session/request_permission` is `{ sessionId: string, permission: { type, title, description } }`. The `sessionId` is a top-level required field in the request params.
- **Confirmed**: Yes
- **Notes**: The SDK method `conn.requestPermission()` requires `{ sessionId, permission: {...} }` or `{ sessionId, options: [...], toolCall: {...} }`. Either way, `sessionId` is mandatory.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `PermissionRequest` type (lines 40-53) has fields: `type`, `toolName?`, `title`, `description`, `arguments?`, `_meta?`. No `sessionId` field. The `PermissionGate.check()` method receives `PermissionRequest` but gets `sessionId` through the constructor instead. This works at runtime but the type doesn't model the wire format correctly.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `sessionId: string` as a required field to `PermissionRequest` type
2. Alternatively, keep `sessionId` separate (as constructor param to `PermissionGate`) and rename the type to `PermissionAction` to avoid confusion with the wire format
3. Ensure the type aligns with ACP wire format: `{ sessionId, permission: { type, title, description } }`
