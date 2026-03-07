# ISS-179 — Spawn Fallback Uses `shell: false` for Terminal Commands

**Severity**: Minor
**File**: src/extensions/acp/terminal-bridge.ts:97
**KB Topic**: Filesystem & Terminal

## Original Issue
Spawn fallback uses `shell: false`. Spec's `terminal/create` sends command as string that may include shell syntax. Consider `shell: true` for the spawn fallback.

## Verification

### Source Code Check
Lines 95-103 show the spawn fallback:
```typescript
const proc = spawn(command, args ?? [], {
  cwd: this.cwd,
  shell: false,
  stdio: 'pipe',
});
```

The `command` variable comes from the ACP `terminal/create` request. The primary path (lines 88-95) uses the ACP client's terminal handle (`this.clientCapabilities.terminal`). The spawn fallback is only used when the ACP terminal capability is unavailable.

### ACP Spec Check
The KB `07-filesystem-terminal.md` describes `terminal/*` methods but does not specify whether the command string may contain shell syntax (pipes, redirects, etc.). The spec defines `terminal/create` parameters but does not explicitly prohibit or require shell interpretation.

The issue raises a valid concern: if a client sends a command string like `npm run build && npm test` expecting shell interpretation, `shell: false` will fail (Node's `spawn` with `shell: false` requires a plain executable name, not a shell compound command). However:
1. This is a fallback path — the primary path delegates to the ACP client terminal, which handles shell interpretation on its own
2. Using `shell: true` introduces security risks (command injection) if the command string comes from untrusted input
3. The correct approach depends on how `terminal/create` commands are expected to be structured

### Verdict: PARTIAL
The issue identifies a real behavioral risk: if the ACP client sends shell compound commands and the fallback path is invoked, `shell: false` will cause silent failure or an unexpected error. However, calling this an ACP compliance issue is an overstatement — the ACP spec does not mandate shell interpretation in fallback paths. It is a defensive implementation concern for the fallback code path. The recommendation to use `shell: true` is also incomplete without addressing the security implications.

## Remediation
1. If `terminal/create` commands may contain shell syntax, the fallback should use `shell: true`:
   ```typescript
   const proc = spawn(command, args ?? [], {
     cwd: this.cwd,
     shell: args === undefined || args.length === 0, // use shell only for bare command strings
     stdio: 'pipe',
   });
   ```
2. Alternatively, document the fallback's limitation: add a comment stating that the spawn fallback requires `command` to be a plain executable (not shell syntax) when `args` is provided.
3. Validate `command` before spawning: if no `args` are provided and the command string contains shell metacharacters (`&&`, `|`, `;`), either use `shell: true` or return an error with a clear message.
4. Consider the security implications of `shell: true` if the command comes from untrusted client input — sanitize or allowlist commands accordingly.
