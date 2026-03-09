# ISS-053: Permission types `mcp` and `extension` not namespaced as custom types

**Severity**: Minor
**Category**: KB-05 Permissions
**File**: `src/types/permissions.ts`
**Lines**: 29-30

## Description

Custom permission types `mcp` and `extension` are defined as bare strings without the `_` prefix convention for custom ACP types.

### Verdict: CONFIRMED

Source at lines 29-30 of `src/types/permissions.ts`:
```typescript
| 'mcp'
| 'extension'
```
The ACP convention (mirroring `SessionConfigOptionCategory` which states "Category names beginning with `_` are free for custom use") applies to permission types as well. Bare `mcp` and `extension` could collide with future ACP-defined permission types. The type comment at line 21 acknowledges these are "GoodVibes internal extensions (not ACP spec)" but does not namespace them.

## Remediation

1. Rename `mcp` to `_goodvibes/mcp` and `extension` to `_goodvibes/extension`.
2. Update all references in `permission-gate.ts` mode configs and `registrar.ts`.

## ACP Reference

KB-05: Custom permission types should use `_` prefix per ACP extensibility convention to avoid collision with future spec values.
