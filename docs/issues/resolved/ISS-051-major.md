# ISS-051: ProjectAnalyzer instantiates sub-analyzers without ITextFileAccess injection

**Severity**: Major
**File**: src/plugins/project/analyzer.ts
**Line(s)**: 209-216
**Topic**: Filesystem & Terminal

## Issue Description
`ProjectAnalyzer` instantiates sub-analyzers (`DependencyAnalyzer`, `SecurityScanner`, `TestAnalyzer`, `DatabaseTools`) without injecting `ITextFileAccess`. This makes the dual-path pattern (editor-aware ACP fs vs direct disk) impossible for any sub-analyzer.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/07-filesystem-terminal.md (lines 165-197)
- **Spec Says**: ACP `fs/*` methods route through the editor for buffer-aware access. `ITextFileAccess` maps directly to `fs/read_text_file` and `fs/write_text_file`. Sub-systems should accept `ITextFileAccess` to enable dual-path (ACP fs for editor reads, direct fs for everything else).
- **Confirmed**: Yes
- **Notes**: The KB explicitly defines an `ITextFileAccess` interface and shows how it should be injected. The interface exists in `src/extensions/acp/fs-bridge.ts` and `src/types/registry.ts` but is never passed to sub-analyzers.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 213-216 show `new DependencyAnalyzer()`, `new SecurityScanner()`, `new TestAnalyzer()`, `new DatabaseTools()` — all constructed with zero arguments. No `ITextFileAccess` parameter is accepted or passed.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `ITextFileAccess` as optional constructor parameter to `ProjectAnalyzer`
2. Pass `ITextFileAccess` through to each sub-analyzer constructor
3. Each sub-analyzer should accept `ITextFileAccess` and use it for file reads instead of direct `fs` calls
4. When `ITextFileAccess` is not provided, fall back to direct disk access (backward compatibility)
