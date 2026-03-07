# ISS-046: fs-bridge readTextFile does not forward line and limit params

**Severity**: Major
**File**: src/extensions/acp/fs-bridge.ts
**Line(s)**: 46-52
**Topic**: Filesystem & Terminal

## Issue Description
`readTextFile` does not forward `line` and `limit` params to ACP wire call. Spec defines optional `line` and `limit` in `fs/read_text_file` request. Add both to `ReadOptions` and forward in the ACP call.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/07-filesystem-terminal.md, lines 62-112
- **Spec Says**: `fs/read_text_file` request params include optional `line` (1-based line number to start reading from) and `limit` (maximum number of lines to return). The TypeScript example shows: `conn.readTextFile({ sessionId, path, line: 10, limit: 50 })`.
- **Confirmed**: Yes
- **Notes**: The `line` and `limit` params enable partial file reads, which is important for large files and for reading specific sections.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 48-51 call `conn.readTextFile({ path, sessionId })` — only `path` and `sessionId` are forwarded. The `options?: ReadOptions` parameter (line 46) is only used for the fallback encoding (line 57), not for ACP-specific params. `ReadOptions` (from registry.ts) has `encoding` and `preferBuffer` but no `line` or `limit` fields.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `line?: number` and `limit?: number` to `ReadOptions` in `src/types/registry.ts`.
2. Forward these params in the ACP call:
   ```typescript
   const response = await this.conn.readTextFile({
     path,
     sessionId: this.sessionId,
     line: options?.line,
     limit: options?.limit,
   });
   ```
3. For the direct disk fallback, implement line/limit slicing on the read content.
