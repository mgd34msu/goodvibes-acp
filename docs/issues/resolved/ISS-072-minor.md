# ISS-072 — Permission type silently defaults to `'mcp'`
**Severity**: Minor
**File**: `src/extensions/hooks/registrar.ts`
**KB Topic**: KB-05: Permission Types

## Original Issue
A missing `permissionType` is silently defaulted to `'mcp'`. ACP defines multiple permission types. A missing value is likely a caller bug that should be logged.

## Verification

### Source Code Check
Line 142 of `registrar.ts`:
```typescript
type: (context.permissionType as string | undefined) ?? 'mcp',
```
When `permissionType` is not provided in the hook context, it silently defaults to `'mcp'` with no warning or log.

### ACP Spec Check
KB-05 defines multiple permission types: `shell`, `file_write`, `file_delete`, `network`, `browser`, and custom types. The `type` field is required in a `Permission` object. Defaulting to `'mcp'` is not one of the spec-defined types — the spec types are action-oriented (shell, file_write, etc.), not transport-oriented.

### Verdict: CONFIRMED
The silent default to `'mcp'` (1) masks a likely caller bug where the permission type was not set, and (2) uses a non-standard type value that doesn't match any of the KB-05 defined types.

## Remediation
1. Add a `console.warn` when `permissionType` is undefined, logging the tool name for debugging.
2. Consider using a more spec-aligned default or requiring callers to provide the type explicitly.
