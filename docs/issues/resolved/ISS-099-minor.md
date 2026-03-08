# ISS-099 — `sessionId` optional on `PermissionRequest` but required on wire

**Severity**: Minor  
**File**: `src/types/permissions.ts`  
**Lines**: 60-61  
**KB Reference**: KB-05 (Permissions)

## Description

`sessionId?: string` is marked optional on `PermissionRequest`, but the ACP wire format requires `sessionId` in every `session/request_permission` call. The `PermissionGate` class receives `sessionId` in its constructor and uses `this.sessionId` directly, making the field on `PermissionRequest` redundant and potentially misleading.

### Verdict: PARTIAL

The wire format compliance is satisfied because `PermissionGate` always includes `this.sessionId` from its constructor. The `PermissionRequest.sessionId` field is never used in the permission request sent to the SDK. This is a type design issue rather than a compliance violation -- the wire request always has sessionId, but the type suggests callers could/should provide it.

## Remediation

1. Remove `sessionId` from `PermissionRequest` type since it is always sourced from `PermissionGate.sessionId`.
2. Alternatively, add a JSDoc comment documenting that this field is ignored in favor of the gate's constructor-injected sessionId.
