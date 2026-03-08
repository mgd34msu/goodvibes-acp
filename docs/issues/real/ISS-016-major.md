# ISS-016 — PermissionType Union Does Not Include ACP-Defined Types

**Severity**: Major
**File**: src/types/permissions.ts:20
**KB Topic**: Permission Types (05-permissions.md lines 81-93)

## Original Issue
`PermissionType` is `'fs' | 'shell' | 'mcp' | 'extension'` while the spec defines `shell`, `file_write`, `file_delete`, `network`, `browser`. Only `shell` matches. The type is also a closed union, preventing the spec-required custom types.

## Verification

### Source Code Check
At `permissions.ts:20`:
```typescript
/**
 * Categories of actions that can be gated by the permission system.
 * Maps to ACP's `permission.type` string field on the wire.
 *
 * ACP spec-defined values: 'fs' | 'shell' | 'mcp' | 'extension'
 */
export type PermissionType = 'fs' | 'shell' | 'mcp' | 'extension';
```
The comment claims these are "ACP spec-defined values" but they are not. Only `shell` appears in the spec.

### ACP Spec Check
KB-05 (permissions.md lines 87-91) defines:
```
| shell       | Execute a shell command      |
| file_write  | Write/create a file          |
| file_delete | Delete a file/directory      |
| network     | Make a network request       |
| browser     | Open or control a browser    |
```

KB-05 line 83 also states: "The protocol defines common types but the field is a string — custom types are allowed."

The code uses `fs` (not in spec), `mcp` (not in spec), `extension` (not in spec) and is missing `file_write`, `file_delete`, `network`, `browser`.

### Verdict: CONFIRMED
The code's `PermissionType` union is incorrect on multiple fronts:
1. Uses non-spec values (`fs`, `mcp`, `extension`) while claiming they are "ACP spec-defined"
2. Missing spec-defined values (`file_write`, `file_delete`, `network`, `browser`)
3. Uses a closed union type, preventing custom types which the spec explicitly allows

## Remediation
1. Update the union to include all spec-defined types: `'shell' | 'file_write' | 'file_delete' | 'network' | 'browser'`
2. Make it an open union to allow custom types: `'shell' | 'file_write' | 'file_delete' | 'network' | 'browser' | (string & {})`
3. If `fs`, `mcp`, and `extension` are needed as internal GoodVibes extensions, document them as such (not ACP spec-defined) and add them alongside the spec types
4. Fix the misleading comment on line 18
