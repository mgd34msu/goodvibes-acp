# ISS-085 — `PermissionRequest.sessionId` documented as ignored but still present

**Severity**: Minor
**File**: `src/types/permissions.ts`
**Lines**: 72–77
**KB Reference**: KB-05 (Permissions)

## Issue

The internal `PermissionRequest` type includes an optional `sessionId` field with JSDoc explicitly stating it is **ignored at runtime**:

```typescript
/**
 * ACP session identifier.
 * @remarks This field is IGNORED at runtime — `PermissionGate` always uses the
 * `sessionId` injected via its constructor.
 */
sessionId?: string;
```

The ACP wire format (KB-05) does include `sessionId` as a required field in `session/request_permission` params. The internal type correctly models this as optional since `PermissionGate` injects the session ID from its constructor.

### Verdict: PARTIAL

The field's presence is correct for interface completeness with the ACP wire format. However, the "IGNORED" documentation creates confusion — callers might pass a different `sessionId` expecting it to be used. The type should either:
- Remove the field entirely (since `PermissionGate` always overrides it), or
- Make the JSDoc clearer that this is intentionally overridden by the gate's constructor-injected value for security reasons.

## Remediation

1. **Option A (Preferred)**: Remove `sessionId` from `PermissionRequest` entirely. Since `PermissionGate` always uses its constructor-injected value, the field serves no purpose and its presence invites misuse.
2. **Option B**: Update JSDoc to explain the security rationale — the gate controls which session the permission is requested for to prevent session spoofing.
