# ISS-152 — `ExtractMode` Missing `'ast'` Value

**Severity**: Minor
**File**: `src/plugins/precision/types.ts:22`
**KB Topic**: Implementation Guide

## Original Issue
`ExtractMode` missing `'ast'` which appears in the MCP tool schema.

## Verification

### Source Code Check
Line 22 of `src/plugins/precision/types.ts`:
```typescript
export type ExtractMode = 'content' | 'outline' | 'symbols' | 'lines';
```

The JSDoc comment (lines 14-21) also only documents four modes:
- `content` — full raw file content
- `outline` — structural overview
- `symbols` — exported declarations only
- `lines` — specific line range only

The `'ast'` mode is missing from both the type definition and the JSDoc. Issue 189 (nitpick) also notes this same problem.

### ACP Spec Check
The ACP spec and KB (`10-implementation-guide.md`) do not define an `ExtractMode` type. This is an internal precision plugin type. The ACP spec defines tool call protocols and session management, but does not prescribe how file-read extract modes are typed in agent plugin code.

### Verdict: NOT_ACP_ISSUE
The issue is real — the `ExtractMode` type is incomplete relative to the actual tool schema. However, this is an internal TypeScript type inconsistency within the precision plugin, not an ACP protocol compliance violation. There is no ACP specification requirement for how extract modes are typed in plugin internals.

## Remediation
N/A for ACP compliance. As a code quality fix:
```typescript
export type ExtractMode = 'content' | 'outline' | 'symbols' | 'lines' | 'ast';
```
And update the JSDoc to include `ast: AST-level structural analysis`.
