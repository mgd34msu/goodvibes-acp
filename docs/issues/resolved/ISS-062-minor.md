# ISS-062 — `PermissionRequest` Type Doesn't Model ACP's Option-Selection Pattern

**Severity**: Minor
**File**: src/types/permissions.ts:30-45
**KB Topic**: Permission Request model (09-typescript-sdk lines 147-165)

## Original Issue
`PermissionRequest` uses a custom `type: PermissionType` with simple grant/deny, missing the ACP SDK's `toolCall` and `options: PermissionOption[]` fields.

## Verification

### Source Code Check
Lines 30-45 of `src/types/permissions.ts` define:
```typescript
export type PermissionRequest = {
  type: PermissionType;
  sessionId?: string;
  toolName?: string;
  toolCallId?: string;
  title: string;
  description: string;
  _meta?: Record<string, unknown>;
};
```

The type uses flat fields (`type`, `title`, `description`) rather than the ACP SDK's structured `toolCall` object and `options: PermissionOption[]` array.

### ACP Spec Check
KB-09 (lines 147-165) shows the ACP SDK permission request shape:
```typescript
{
  sessionId: string,
  toolCall: {
    title: string,
    // tool-specific fields
  },
  options: PermissionOption[]
}
```

The response uses `{ outcome: { outcome: "selected", optionId: string } }` rather than simple `{ granted: boolean }`.

KB-05 (line 85-100) shows the permission object has `type`, `title`, `description` fields — which the code does model. However, the wire-level request wraps these in a `toolCall` object and adds `options: PermissionOption[]`.

### Verdict: PARTIAL
The code's `PermissionRequest` type correctly models the permission object shape (`type`, `title`, `description`) as defined in KB-05. However, it does not model the full `session/request_permission` wire request which wraps this in a `toolCall` object and includes `options: PermissionOption[]`. The current type is a valid internal abstraction but differs from the ACP SDK's wire format. The `PermissionGate` class separately handles the SDK call, so this is an abstraction gap rather than a functional bug.

## Remediation
1. Consider adding a `toolCall` wrapper field or a separate `AcpPermissionWireRequest` type that models the SDK's expected shape
2. Add `options: PermissionOption[]` field to support the option-selection pattern
3. Update `PermissionGate.requestFromClient()` to construct proper `PermissionOption` entries (allow/deny/always_allow)
