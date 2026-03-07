# ISS-190 — Comment Uses Wrong Tool Name `'precision__read_file'`

**Severity**: Nitpick
**File**: `src/plugins/agents/loop.ts:241-242`
**KB Topic**: Implementation Guide

## Original Issue
`[src/plugins/agents/loop.ts:241-242]` Comment says `'precision__read_file'` but actual names would be `'precision__precision_read'`. *(Implementation Guide)*

## Verification

### Source Code Check
Lines 237–242 of `src/plugins/agents/loop.ts`:
```typescript
/**
 * Split a namespaced tool name into [providerName, toolName].
 * e.g. 'precision__read_file' → ['precision', 'read_file']
 * If no '__' separator, returns ['', fullName].
 */
private _splitToolName(fullName: string): [string, string] {
```
The JSDoc example uses `'precision__read_file'` as the sample tool name. The actual tool registered under the precision plugin is `precision_read` (from `src/plugins/precision/read.ts`), which when namespaced becomes `precision__precision_read`, not `precision__read_file`.

### ACP Spec Check
The ACP Implementation Guide (KB 10) and GOODVIBES.md document tool names as namespaced with `__` separator: `providerName__toolName`. The precision plugin tools are named `precision_read`, `precision_write`, `precision_edit`, etc. — meaning their namespaced forms are `precision__precision_read`, `precision__precision_write`, etc.

This is a documentation/comment accuracy issue. The `_splitToolName` method itself is correct — the algorithm works regardless of what tool names are actually used. Only the JSDoc example is wrong.

### Verdict: CONFIRMED
The JSDoc example `'precision__read_file' → ['precision', 'read_file']` uses a non-existent tool name. The actual precision plugin tool name for file reading is `precision_read`, making the namespaced form `precision__precision_read`. The comment is misleading to readers trying to understand what tool names look like in practice.

## Remediation
Update the JSDoc example in `src/plugins/agents/loop.ts`:
```typescript
/**
 * Split a namespaced tool name into [providerName, toolName].
 * e.g. 'precision__precision_read' → ['precision', 'precision_read']
 * If no '__' separator, returns ['', fullName].
 */
```
