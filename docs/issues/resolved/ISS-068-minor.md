# ISS-068 — `MODE_POLICIES` Uses Non-Spec Permission Types

**Severity**: Minor
**File**: src/extensions/acp/permission-gate.ts:37-57
**KB Topic**: Mode-Based Auto-Approval (05-permissions.md lines 362-379)

## Original Issue
`MODE_POLICIES` uses custom permission types (`fs`, `shell`, `mcp`, `extension`) that don't align with spec-defined types. The `plan` mode auto-approves all `fs` (filesystem) when the spec distinguishes `file_write` from `file_delete`.

## Verification

### Source Code Check
Lines 37-57 of `src/extensions/acp/permission-gate.ts`:
```typescript
export const MODE_POLICIES: Record<string, PermissionPolicy> = {
  justvibes: {
    autoApprove: ['fs', 'shell', 'mcp', 'extension'],
    alwaysDeny: [],
    promptForUnknown: false,
  },
  vibecoding: {
    autoApprove: ['fs', 'shell', 'mcp'],
    alwaysDeny: [],
    promptForUnknown: true,
  },
  plan: {
    autoApprove: ['fs'],
    alwaysDeny: ['shell'],
    promptForUnknown: true,
  },
  sandbox: {
    autoApprove: ['mcp', 'fs'],
    alwaysDeny: ['extension'],
    promptForUnknown: true,
  },
};
```

The `PermissionType` (from `src/types/permissions.ts` line 20) is defined as `'fs' | 'shell' | 'mcp' | 'extension'`.

### ACP Spec Check
KB-05 (lines 85-93) defines the spec permission types:

| Type | Meaning |
|------|--------|
| `shell` | Execute a shell command |
| `file_write` | Write/create a file |
| `file_delete` | Delete a file/directory |
| `network` | Make a network request |
| `browser` | Open or control a browser |

The spec uses `file_write` and `file_delete` (distinguishing write from delete), while the code uses a single `fs` category. The spec has `network` and `browser` types not present in the code. The code has `mcp` and `extension` types not in the spec (though the spec notes custom types are allowed).

Critically, the `plan` mode auto-approves all `fs` operations — but in spec terms, this would auto-approve both `file_write` and `file_delete`, losing the granularity the spec provides.

### Verdict: CONFIRMED
The permission types used in the code (`fs`, `mcp`, `extension`) do not align with the ACP spec's defined types (`file_write`, `file_delete`, `network`, `browser`). While custom types are allowed, using non-spec types means permission requests from spec-compliant clients using `file_write` or `network` would not match any policy rule, falling through to `promptForUnknown`.

## Remediation
1. Update `PermissionType` to include spec-defined types: `'shell' | 'file_write' | 'file_delete' | 'network' | 'browser' | 'mcp' | 'extension'`
2. Update `MODE_POLICIES` to use granular spec types:
   - Replace `'fs'` with `['file_write', 'file_delete']` (or only `'file_write'` for plan mode)
   - Add `'network'` and `'browser'` to appropriate policies
3. For `plan` mode specifically, consider auto-approving only `file_write` (reads) while denying `file_delete`
