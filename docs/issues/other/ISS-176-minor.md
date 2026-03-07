# ISS-176 — Non-Null Assertion on `stdin` in MCP Transport

**Severity**: Minor
**File**: src/extensions/mcp/transport.ts:177-178
**KB Topic**: Tools & MCP

## Original Issue
`stdin.write` uses non-null assertion (`this._process.stdin!`). Unhelpful `TypeError` on null. Add guard or assert in constructor that stdin/stdout are available.

## Verification

### Source Code Check
Lines 177-178 (in `_request`) and 185 (in `_notify`):
```typescript
this._process.stdin!.write(JSON.stringify(msg) + '\n', 'utf8');
```

The `!` non-null assertion suppresses the TypeScript compiler warning. If `stdin` is null (which happens when stdio is not set to `'pipe'` or process spawn fails), this throws a `TypeError: Cannot read properties of null (reading 'write')` — an unhelpful error message.

### ACP Spec Check
This is an internal implementation robustness concern for the MCP transport layer. The ACP specification does not define how agents manage their internal process spawning or stdio handling. The spec requires that agents connect to MCP servers via stdio — it does not specify how the connection is implemented or how errors are surfaced.

This is not an ACP protocol compliance issue. It is a defensive programming and error quality concern.

### Verdict: NOT_ACP_ISSUE
The issue is real — the non-null assertion can produce an unhelpful `TypeError` if process spawning fails silently. However, it has no ACP protocol compliance implications. The fix improves runtime error messages and defensive coding practices, not ACP wire format adherence.

## Remediation
N/A for ACP compliance. For code quality:
1. Add a constructor or spawn-time assertion:
   ```typescript
   if (!this._process.stdin || !this._process.stdout) {
     throw new Error(`[McpTransport] Process spawned without stdin/stdout pipes — check stdio: 'pipe' option`);
   }
   ```
2. Or cache `stdin`/`stdout` as non-nullable private fields after the assertion:
   ```typescript
   private readonly _stdin: NodeJS.WritableStream;
   // in constructor:
   if (!proc.stdin) throw new Error('stdin unavailable');
   this._stdin = proc.stdin;
   ```
3. Remove the `!` assertions from `_request` and `_notify` methods.
