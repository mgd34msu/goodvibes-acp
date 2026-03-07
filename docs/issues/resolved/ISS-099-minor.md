# ISS-099: SessionConfigOptionChoice uses label instead of name

**Severity**: Minor
**File**: src/types/config.ts
**Line(s)**: 80
**Topic**: Initialization

## Issue Description
`SessionConfigOptionChoice` uses `label` instead of `name`. ACP SDK type `SessionConfigSelectOption` uses `name: string`.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 03-sessions.md, lines 260-274
- **Spec Says**: The `ConfigOptionValue` interface defines: `value: string; name: string; description?: string;`. The field for the human-readable label is `name`, not `label`.
- **Confirmed**: Yes
- **Notes**: The spec examples also use `name` in option values: `{ "value": "ask", "name": "Ask", "description": "..." }`. Using `label` instead of `name` will cause serialization mismatches when building ACP responses.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 76-83 define `SessionConfigOptionChoice` with fields `value: string`, `label: string`, `description?: string`. The field is `label` where the ACP spec requires `name`.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Rename `label` to `name` in `SessionConfigOptionChoice`:
   ```typescript
   export type SessionConfigOptionChoice = {
     value: string;
     name: string;  // was: label
     description?: string;
   };
   ```
2. Update all usages of `.label` to `.name` across the codebase (search for `SessionConfigOptionChoice` references).
3. If backwards compatibility is needed, add a serialization step in the config-adapter that maps `label` to `name` in the ACP wire format.
