# ISS-072 — No permission gate documentation for fs-bridge callers
**Severity**: Medium
**File**: `src/extensions/acp/fs-bridge.ts`
**KB Topic**: KB-05: Permissions

## Original Issue
Performs reads/writes without permission checks. No documentation that callers must gate through PermissionGate.

## Verification

### Source Code Check
`src/extensions/acp/fs-bridge.ts` contains zero references to `permission`, `PermissionGate`, or any permission-related logic. The file implements `ITextFileAccess` and directly performs file operations via ACP client fs methods or Node.js fs.

### ACP Spec Check
KB-05 defines `session/request_permission` as the gated checkpoint before side-effecting operations. File writes are side-effecting and should be gated. The spec allows delegation of permission checking to callers, but this should be documented.

### Verdict: CONFIRMED
The fs-bridge performs file reads and writes without any permission gating and without documenting that callers bear responsibility for permission checks. KB-05 requires permission gates for side-effecting operations like file writes.

## Remediation
1. Add JSDoc to class and write methods noting caller responsibility for permission gating via `session/request_permission`.
2. Consider adding an optional `permissionGate` callback parameter for write operations.
3. At minimum, document the permission model so callers know they must check permissions before calling write methods.
