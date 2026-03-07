# ISS-050: SecurityScanner uses direct fs instead of ITextFileAccess

**Severity**: Major
**File**: src/plugins/project/security.ts
**Line(s)**: 9, 176, 279
**Topic**: Filesystem & Terminal

## Issue Description
`SecurityScanner` reads files directly. Bypasses `ITextFileAccess`. Scanning unsaved content for secrets is arguably more critical.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/07-filesystem-terminal.md, lines 47-54
- **Spec Says**: ACP `fs/*` methods route through the editor. Read returns unsaved buffer state. The spec emphasizes that editor buffer reads capture content that may not yet be on disk — including potentially sensitive content like hardcoded secrets that a user is actively typing.
- **Confirmed**: Yes
- **Notes**: This is a stronger case than issue 49. A security scanner that only reads from disk will miss secrets that exist in unsaved editor buffers — the exact moment when a user might benefit most from a warning.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 9 imports `readFile` from `node:fs/promises`. Line 176 uses `readFile` to read `.gitignore` content. Line 279 uses `readFile` to read source files for secret pattern scanning (`readFile(filePath, 'utf-8')`). The class constructor takes no `ITextFileAccess` parameter. Additionally, `readdir` and `stat` are used for file discovery (lines 102, 183, 236) — these have no ACP equivalent.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `ITextFileAccess` as a constructor parameter to `SecurityScanner`.
2. Replace `readFile(filePath, 'utf-8')` calls (lines 176, 279) with `this.fileAccess.readTextFile(filePath)`.
3. Keep `readdir` and `stat` as direct fs calls since ACP only covers text file read/write.
4. Update the plugin registration to inject the `ITextFileAccess` instance.
5. Consider adding a real-time scanning mode that hooks into editor buffer change events for proactive secret detection.
