# ISS-051 — DatabaseTools Uses Direct readFile Instead of ITextFileAccess

**Severity**: Major
**File**: src/plugins/project/db.ts:9,33
**KB Topic**: ACP Tools and MCP Integration (06-tools-mcp.md lines 589-616)

## Original Issue
`DatabaseTools` uses `node:fs/promises` `readFile` directly instead of accepting `ITextFileAccess` like `DependencyAnalyzer`, `SecurityScanner`, and `TestAnalyzer`.

## Verification

### Source Code Check
Line 9 imports `readFile` from `node:fs/promises`:
```typescript
import { readFile } from 'node:fs/promises';
```
Line 33 calls it directly:
```typescript
content = await readFile(schemaPath, 'utf-8');
```
A comment at lines 21-23 acknowledges this deviation:
```typescript
// @note Uses direct `node:fs/promises` calls rather than the ITextFileAccess
// abstraction used elsewhere in the project.
```

### ACP Spec Check
KB-06 (lines 589-616) states that ACP `fs/read_text_file` returns unsaved editor buffer state, which is preferred over direct disk reads. The ACP client filesystem provides buffer-aware reads that reflect the editor's current state, not just what is saved to disk.

### Verdict: CONFIRMED
The code explicitly uses direct filesystem reads bypassing the `ITextFileAccess` abstraction. This is inconsistent with all other sub-analyzers in the plugin and means `DatabaseTools` will read stale disk state instead of unsaved editor buffers. The existing code comment acknowledges the inconsistency.

## Remediation
1. Add `ITextFileAccess` as a constructor parameter to `DatabaseTools`
2. Replace `readFile(schemaPath, 'utf-8')` with `this._fileAccess.readFile(schemaPath)`
3. Remove the `import { readFile } from 'node:fs/promises'` import
4. Update the instantiation site to inject the shared `ITextFileAccess` instance
