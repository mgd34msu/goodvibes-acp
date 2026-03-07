# ISS-012: PermissionType enum misaligned with ACP spec

**Severity**: Critical
**File**: src/types/permissions.ts
**Line(s)**: 18-23
**Topic**: Permissions

## Issue Description
`PermissionType` misaligned with ACP spec. Spec defines: `shell`, `file_write`, `file_delete`, `network`, `browser`. Implementation defines: `tool_call`, `file_write`, `file_read`, `command_execute`, `network_access`. Only `file_write` matches.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 81-93
- **Spec Says**: The `permission.type` field defines these standard types: `shell` (execute a shell command), `file_write` (write/create a file), `file_delete` (delete a file/directory), `network` (make a network request), `browser` (open or control a browser). Custom types are allowed as the field is a string.
- **Confirmed**: Yes
- **Notes**: The spec explicitly lists the five standard types and notes custom types are permitted. The implementation's types (`tool_call`, `file_read`, `command_execute`, `network_access`) are not recognized standard types.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 18-23 define `PermissionType = 'tool_call' | 'file_write' | 'file_read' | 'command_execute' | 'network_access'`. Only `file_write` matches a spec-defined type. `tool_call` and `file_read` have no spec equivalent. `command_execute` should be `shell`. `network_access` should be `network`.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
Four of five permission types are non-standard. Clients expecting spec-standard types will not recognize permission requests from this implementation.

## Remediation Steps
1. Change `PermissionType` to `'shell' | 'file_write' | 'file_delete' | 'network' | 'browser' | string`
2. Update `MODE_POLICIES` in `permission-gate.ts` to use the new type values
3. Map any GoodVibes-specific permission categories (like `file_read`, `tool_call`) to custom string types with an underscore prefix (e.g., `_goodvibes/file_read`)
4. Update all call sites that reference the old type values
