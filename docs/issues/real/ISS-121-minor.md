# ISS-121 — TestAnalyzer Reads Test Files Directly, Bypassing ITextFileAccess

**Severity**: Minor
**File**: `src/plugins/project/test.ts:8,99,127`
**KB Topic**: Filesystem & Terminal

## Original Issue
`TestAnalyzer` reads test files directly — misses editor buffer state. *(Filesystem & Terminal)*

## Verification

### Source Code Check
Line 8 imports `readFile` from `node:fs/promises` directly:
```typescript
import { readFile, readdir } from 'node:fs/promises';
```

Line 99 uses it to read test file content:
```typescript
const content = await readFile(filePath, 'utf-8');
```

Line 127 uses it again in `detectFramework`:
```typescript
const content = await readFile(filePath, 'utf-8');
```

No `ITextFileAccess` is injected or used. The class takes no constructor arguments.

### ACP Spec Check
KB-07 (Filesystem & Terminal) explains why ACP `fs/*` methods matter:
> "Read returns **unsaved buffer state** (what's in the editor, not what's on disk). Write notifies the editor so it can track dirty state, trigger LSP reanalysis, etc."

The spec defines an `ITextFileAccess` pattern:
```typescript
interface ITextFileAccess {
  readTextFile(path: string, opts?: { line?: number; limit?: number }): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
}
```

For a standalone runtime, KB-07 notes: "both patterns apply: use ACP fs for editor-aware reads/writes, use direct fs for everything else." Test file analysis is a code-inspection task — whether it should read from editor buffers depends on whether the user might have unsaved test changes they want analyzed.

### Verdict: CONFIRMED
The code confirms the issue. `TestAnalyzer` hard-codes direct `node:fs/promises` reads with no mechanism to accept `ITextFileAccess` injection. This means when called from the ACP context, it cannot see unsaved editor buffer state. The ACP KB explicitly identifies this as a dual-path concern. The issue is accurately described.

## Remediation
1. Add `ITextFileAccess` as an optional constructor parameter to `TestAnalyzer` (with fallback to direct `readFile` when not provided):
   ```typescript
   export class TestAnalyzer {
     constructor(private readonly _fs?: ITextFileAccess) {}
   }
   ```
2. Replace `readFile(filePath, 'utf-8')` calls with `this._fs ? await this._fs.readTextFile(filePath) : await readFile(filePath, 'utf-8')`.
3. Inject `ITextFileAccess` when constructing `TestAnalyzer` inside the ACP session context.
