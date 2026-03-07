# ISS-047: ITextFileAccess.readTextFile signature doesn't match spec interface

**Severity**: Major
**File**: src/types/registry.ts
**Line(s)**: 221-226
**Topic**: Filesystem & Terminal

## Issue Description
`ITextFileAccess.readTextFile` signature doesn't match spec interface. Spec: `readTextFile(path, opts?: { line?, limit? })`. Actual `ReadOptions` has `encoding`/`preferBuffer` but lacks `line`/`limit`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/07-filesystem-terminal.md, lines 165-195
- **Spec Says**: The `ITextFileAccess` mapping shows: `readTextFile(path: string, opts?: { line?: number; limit?: number }): Promise<string>`. The options object should contain `line` and `limit` for partial file reads.
- **Confirmed**: Yes
- **Notes**: The KB explicitly defines the interface mapping with `line` and `limit` as the option fields.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 223 defines `readTextFile(path: string, options?: ReadOptions): Promise<string>`. The `ReadOptions` type (not shown in the extracted range but referenced) contains `encoding` and `preferBuffer` — fields not in the ACP spec — while missing `line` and `limit` which ARE in the spec.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `line?: number` and `limit?: number` to the `ReadOptions` type.
2. The existing `encoding` and `preferBuffer` fields can remain as implementation-specific extensions since they are used by the direct disk fallback path.
3. Ensure that all `ITextFileAccess` implementations (including `AcpFileSystem`) forward `line` and `limit` when calling `conn.readTextFile()`.
