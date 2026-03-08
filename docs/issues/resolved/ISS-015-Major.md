# ISS-015 — PermissionOption type shape mismatches actual SDK usage

**Severity**: Major
**File**: src/types/permissions.ts
**KB Topic**: KB-05: Permission Object Shape

## Original Issue
The `PermissionOption` type defines `{ id: string; label: string }`, but `permission-gate.ts` constructs options with `{ optionId, kind, name }` using the SDK type. The local type is never used in the actual permission flow — it is dead code creating a false sense of type safety.

## Verification

### Source Code Check
At lines 41-46 of `src/types/permissions.ts`:
```typescript
export type PermissionOption = {
  id: string;
  label: string;
};
```

The SDK `PermissionOption` type (lines 1518-1541 of `types.gen.d.ts`) has:
```typescript
export type PermissionOption = {
  kind: PermissionOptionKind;  // "allow_once" | "allow_always" | "reject_once" | "reject_always"
  name: string;
  optionId: PermissionOptionId;
};
```

The local type uses `id`/`label` while the SDK uses `optionId`/`kind`/`name`. The `permission-gate.ts` file uses the SDK type directly via `buildPermissionOptions()`, not this local type.

### ACP Spec Check
KB-05 describes the permission wire format with `{ type, title, description }` for the permission object, and KB-09 documents the SDK's `PermissionOption` with `{ optionId, kind, name }`. The local type matches neither.

### Verdict: PARTIAL
The type mismatch is real — the local `PermissionOption` type has the wrong shape compared to the SDK type. However, this is primarily a dead code / type hygiene issue. The actual permission flow uses the SDK type directly, so no ACP wire format violation occurs at runtime. The issue overstates the ACP compliance impact.

## Remediation
1. Either update the local `PermissionOption` type to match the SDK shape: `{ optionId: string; kind: PermissionOptionKind; name: string; }`
2. Or remove the local type entirely and import from the SDK: `import type { PermissionOption } from '@agentclientprotocol/sdk/schema'`
