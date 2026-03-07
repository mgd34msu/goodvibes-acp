# ISS-068: PermissionRequest includes non-spec arguments field

**Severity**: Major
**File**: src/types/permissions.ts
**Line(s)**: 40-53
**Topic**: Permissions

## Issue Description
`PermissionRequest` includes `arguments` field that is not part of the ACP spec's `Permission` object shape. Spec defines: `type` (required), `title` (required), `description` (required), `_meta` (optional).

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 96-103
- **Spec Says**: Permission object shape is `{ type: string, title: string, description: string, _meta?: Record<string, unknown> }`. Four fields only.
- **Confirmed**: Yes
- **Notes**: The `arguments` field is not part of the ACP Permission type. The spec's `_meta` field is the designated extensibility point for additional data.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 50 defines `arguments?: Record<string, unknown>` on `PermissionRequest`. This field has no ACP spec counterpart. It's used in `permission-gate.ts` line 144 as `rawInput: request.arguments ?? null` in the SDK permission request, which maps to the toolCall's `rawInput` — not the Permission object itself. The mapping is indirect and confusing.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Remove `arguments` field from `PermissionRequest` type
2. If tool input preview is needed, pass it through `_meta` instead: `_meta: { rawInput: {...} }`
3. Alternatively, separate the Permission wire type from the internal request type to avoid confusion
4. Update `permission-gate.ts` to source `rawInput` from a different mechanism (e.g., tool call context passed separately)
