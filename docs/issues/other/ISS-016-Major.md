# ISS-016 — PermissionRequest.toolCall and .options fields are unused dead code

**Severity**: Major
**File**: src/types/permissions.ts
**KB Topic**: KB-05: Wire Format

## Original Issue
These fields are declared but never consumed by `PermissionGate.check()`. The gate constructs its own `toolCall` object and generates options via `buildPermissionOptions()`. These unused fields add confusion about the actual data flow.

## Verification

### Source Code Check
At lines 71-81 of `src/types/permissions.ts`:
```typescript
toolCall?: Record<string, unknown>;
options?: PermissionOption[];
```

In `permission-gate.ts`, the `check()` method constructs its own `toolCall` object (lines 179-184) and calls `buildPermissionOptions()` for the options array. The `request.toolCall` and `request.options` fields from the `PermissionRequest` type are never read.

### ACP Spec Check
The ACP wire format for `RequestPermissionRequest` requires `toolCall: ToolCallUpdate` and `options: Array<PermissionOption>`. The code correctly constructs these from other request fields. The issue is about unused type fields, not about wire format compliance.

### Verdict: NOT_ACP_ISSUE
The unused fields on the internal `PermissionRequest` type are a code quality concern (dead code, confusing API surface), but they do not affect ACP protocol compliance. The actual ACP wire format is constructed correctly in `permission-gate.ts` using the appropriate SDK types.

## Remediation
N/A
