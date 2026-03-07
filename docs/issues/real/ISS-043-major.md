# ISS-043: MCP transport has no request timeout

**Severity**: Major
**File**: src/extensions/mcp/transport.ts
**Line(s)**: 169-179
**Topic**: Tools & MCP

## Issue Description
No request timeout — MCP server hang causes indefinite block.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/06-tools-mcp.md (general implementation guidance)
- **Spec Says**: The ACP spec does not explicitly mandate a timeout value for MCP tool calls. However, the spec's tool call lifecycle (pending -> running -> completed/failed) implies that tool calls should eventually resolve. The implementation guide and general robustness expectations require that hanging processes be handled.
- **Confirmed**: Partial
- **Notes**: This is a robustness/implementation quality issue rather than a direct ACP spec violation. The ACP spec does not prescribe timeout values, but indefinite blocking is a well-known anti-pattern in async systems.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: The `_request` method (lines 169-179) creates a Promise that resolves when a matching JSON-RPC response arrives. There is no `setTimeout` or `AbortController` — if the MCP server never responds, the promise hangs forever. The `_pending` map entry is only cleaned up on process exit/error (lines 193-198), not on timeout.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add a configurable timeout (e.g., 30s default) to `_request()` using `setTimeout`.
2. On timeout, reject the pending promise with a descriptive error and remove it from `_pending`.
3. Consider adding a per-tool-call timeout that can be configured at the bridge level.
4. Example implementation:
   ```typescript
   const timer = setTimeout(() => {
     this._pending.delete(id);
     reject(new Error(`MCP request timeout after ${timeoutMs}ms: ${method}`));
   }, timeoutMs);
   ```
