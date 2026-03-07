# ISS-049: DependencyAnalyzer uses direct fs instead of ITextFileAccess

**Severity**: Major
**File**: src/plugins/project/deps.ts
**Line(s)**: 9, 20, 62
**Topic**: Filesystem & Terminal

## Issue Description
`readFile` from `node:fs/promises` used directly instead of `ITextFileAccess`. Will never read unsaved editor buffer state.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/07-filesystem-terminal.md, lines 47-54
- **Spec Says**: ACP `fs/*` methods route through the editor, not the OS filesystem. Read returns unsaved buffer state. For a standalone runtime, both patterns apply: use ACP fs for editor-aware reads/writes, use direct fs for everything else. The spec emphasizes that `ITextFileAccess` exists specifically to provide buffer-aware file access.
- **Confirmed**: Partial
- **Notes**: The spec provides `ITextFileAccess` as the abstraction for editor-aware reads. However, `DependencyAnalyzer` reads `package.json` and source files for import analysis — these are typically saved files where buffer state is less critical. The issue is valid from an architectural consistency standpoint but the practical impact is low for this specific use case.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 9 imports `readFile` from `node:fs/promises`. Line 20 uses it to read JSON files (`readFile(filePath, 'utf-8')`). Line 62 uses it to read source files for import extraction (`readFile(filePath, 'utf-8')`). The class constructor takes no `ITextFileAccess` parameter — there's no way to inject the ACP-aware file reader.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `ITextFileAccess` as a constructor parameter to `DependencyAnalyzer`.
2. Replace `readFile(filePath, 'utf-8')` calls with `this.fileAccess.readTextFile(filePath)`.
3. The class also uses `readdir` and `stat` from node:fs — these have no ACP equivalent and can remain as direct fs calls (ACP only covers text file read/write).
4. Update the plugin registration to inject the `ITextFileAccess` instance.
