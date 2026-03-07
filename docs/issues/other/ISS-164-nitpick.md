# ISS-164 — Duplicated Stdio Transport Creation in Subprocess Mode

**Severity**: Nitpick
**File**: src/main.ts:410-413
**KB Topic**: Overview

## Original Issue
**[src/main.ts:410-413]** Duplicated stdio transport creation in subprocess mode. `createStdioTransport()` is exported but not imported in `main.ts`. Use it instead of inline `acp.ndJsonStream(...)`. *(Overview)*

## Verification

### Source Code Check
`createStdioTransport()` is exported from `src/extensions/acp/transport.ts` (line 102) and from `src/extensions/acp/index.ts` (line 18). However, `main.ts` imports only `type { AcpStream }` from transport.ts and never imports `createStdioTransport`.

In subprocess mode (lines 428-431 of main.ts), the transport is created inline:
```typescript
const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as unknown as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>,
);
```
This is exactly what `_createStdioTransport()` in transport.ts does internally. The utility function exists but isn't used in the subprocess path of main.ts.

### ACP Spec Check
The ACP specification does not prescribe code organization patterns within an agent implementation. Whether stdio transport setup is inline or extracted into a utility function is an internal code organization decision.

### Verdict: NOT_ACP_ISSUE
The duplication is a real code smell — the `createStdioTransport()` function was clearly written to be used here, but main.ts bypasses it. This is a refactoring opportunity. However, it has no impact on ACP protocol compliance since the actual behavior is identical.

## Remediation
N/A — Not an ACP compliance issue.

For code quality improvement (optional):
- Import `createStdioTransport` from `'./extensions/acp/transport.js'` in `main.ts`
- Replace the inline `acp.ndJsonStream(...)` block in subprocess mode with `createStdioTransport()`
