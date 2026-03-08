# ISS-061 — `fromGrantedBoolean()` Is Runtime Code in L0 Type-Only Module

**Severity**: Minor
**File**: src/types/permissions.ts:61-63
**KB Topic**: L0 Layer Contract (file header, line 2)

## Original Issue
`fromGrantedBoolean()` is a runtime function in a module declaring `@layer L0 — pure types, no runtime code`. This violates the project's own architectural layering contract.

## Verification

### Source Code Check
Line 3 of `src/types/permissions.ts` declares:
```typescript
 * @layer L0 — pure types, no runtime code
```

Lines 61-63 define a runtime function:
```typescript
export function fromGrantedBoolean(granted: boolean): PermissionStatus {
  return granted ? 'granted' : 'denied';
}
```

This is a concrete runtime function (not a type) in a module explicitly tagged as containing only types.

### ACP Spec Check
The ACP spec itself does not define a layer system — this is a project-internal architectural convention. However, the `@layer L0` annotation is a self-imposed contract. The ACP wire format uses `{ granted: boolean }` directly, so this conversion function is an internal concern that belongs in an L1 or L2 module.

### Verdict: CONFIRMED
The file explicitly declares itself as L0 (pure types, no runtime code), yet contains a runtime function. This violates the project's own layering contract.

## Remediation
1. Move `fromGrantedBoolean()` and `PermissionStatus` type to an L1 utility module (e.g., `src/extensions/acp/permission-utils.ts`)
2. Keep `src/types/permissions.ts` as pure types only
3. Update any imports accordingly (note: per ISS-067, this function has zero call sites, so it may simply be deletable)
