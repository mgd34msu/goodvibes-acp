# ISS-050 — DatabaseTools lacks ITextFileAccess injection

**Severity**: Minor
**File**: `src/plugins/project/db.ts`
**KB Topic**: KB-06: ACP File Access

## Original Issue
`DatabaseTools` uses raw `readFile` from `node:fs/promises` while the other three analyzers accept an optional `ITextFileAccess` for ACP-compliant reads. Prisma schema parsing always reads stale disk state rather than editor buffers.

## Verification

### Source Code Check
Line 9:
```typescript
import { readFile } from 'node:fs/promises';
```
Line 37 (in `parsePrismaSchema`):
```typescript
content = await readFile(schemaPath, 'utf-8');
```
The class has no constructor and no `ITextFileAccess` parameter. The code comment at lines 21-27 explicitly acknowledges this issue (ISS-051), documenting that `DatabaseTools` reads stale disk state and listing the exact fix steps.

### ACP Spec Check
KB-06 line 613: ACP `fs/read_text_file` "Returns unsaved editor buffer (not just disk state)". The ACP file access abstraction exists so tools read the current editor state rather than what was last saved to disk.

### Verdict: CONFIRMED
The code explicitly acknowledges this gap via the ISS-051 comment. `DatabaseTools` uses raw `node:fs/promises` while the other analyzers (`DependencyAnalyzer`, `SecurityScanner`, `TestAnalyzer`) use `ITextFileAccess`. This means Prisma schema parsing always reads disk state, missing unsaved changes.

## Remediation
1. Add `ITextFileAccess` as an optional constructor parameter to `DatabaseTools`
2. Replace `readFile(schemaPath, 'utf-8')` with `this._fileAccess.readFile(schemaPath)` (with fallback to `node:fs/promises` if no access provided)
3. Update the instantiation in `ProjectAnalyzer` (analyzer.ts line 216) to inject the shared `ITextFileAccess` instance
4. Remove the `node:fs/promises` import once all direct `readFile` calls are replaced
