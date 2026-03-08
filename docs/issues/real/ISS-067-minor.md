# ISS-067 — `PermissionStatus` and `fromGrantedBoolean()` Are Unused Dead Code

**Severity**: Minor
**File**: src/types/permissions.ts:58-63
**KB Topic**: Permission Result (05-permissions.md lines 43-65)

## Original Issue
`PermissionStatus` type and `fromGrantedBoolean()` function are defined but have no call sites in the codebase. `PermissionResult` already uses `granted: boolean` directly.

## Verification

### Source Code Check
Lines 58-63 of `src/types/permissions.ts`:
```typescript
export type PermissionStatus = 'granted' | 'denied';

export function fromGrantedBoolean(granted: boolean): PermissionStatus {
  return granted ? 'granted' : 'denied';
}
```

Grep results for `fromGrantedBoolean` across `src/**/*.ts` return only the definition site (line 61 of permissions.ts). Zero call sites exist anywhere in the codebase.

The `PermissionResult` type on lines 66-71 uses `granted: boolean` directly, matching the ACP wire format.

### ACP Spec Check
KB-05 confirms the wire format uses `{ granted: boolean }`. The `PermissionResult` type already models this correctly. The `PermissionStatus` string enum (`'granted' | 'denied'`) and its conversion function add an unnecessary abstraction layer with no consumers.

### Verdict: CONFIRMED
Both `PermissionStatus` and `fromGrantedBoolean()` are dead code with zero call sites. They also violate the L0 layer contract (see ISS-061).

## Remediation
1. Delete `PermissionStatus` type (line 58) and `fromGrantedBoolean()` function (lines 60-63)
2. This also resolves ISS-061 (runtime code in L0 module) as a side effect
