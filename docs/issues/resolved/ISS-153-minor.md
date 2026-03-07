# ISS-153 — Stale Example Tool Name in JSDoc Comment

**Severity**: Minor
**File**: `src/plugins/agents/loop.ts:241-242`
**KB Topic**: Implementation Guide

## Original Issue
Comment says `'precision__read_file'` but actual names would be `'precision__precision_read'`.

## Verification

### Source Code Check
Lines 237-242 of `src/plugins/agents/loop.ts`:
```typescript
/**
 * Split a namespaced tool name into [providerName, toolName].
 * e.g. 'precision__read_file' → ['precision', 'read_file']
 * If no '__' separator, returns ['', fullName].
 */
private _splitToolName(fullName: string): [string, string] {
```

The JSDoc example uses `'precision__read_file'` as the demonstration tool name. The actual tool is registered as `precision__precision_read` (the precision plugin's `precision_read` tool, namespaced under `precision__`). So the example tool name in the comment is stale/incorrect.

### ACP Spec Check
The ACP spec does not prescribe how internal tool namespacing comments should be written. This is a documentation accuracy issue within the implementation, not an ACP wire format violation.

### Verdict: NOT_ACP_ISSUE
The issue is confirmed — the comment uses a non-existent example tool name. However, this is a stale JSDoc comment, not an ACP protocol compliance problem. The `_splitToolName` logic itself is correct (splitting on `__`); only the illustrative example is wrong.

## Remediation
N/A for ACP compliance. As a code quality fix, update the comment:
```typescript
 * e.g. 'precision__precision_read' → ['precision', 'precision_read']
```
