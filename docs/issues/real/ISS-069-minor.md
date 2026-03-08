# ISS-069: Terminal bridge null exit code maps to 0 (success) instead of -1

**Severity**: Minor  
**File**: `src/extensions/acp/terminal-bridge.ts`  
**Lines**: 229  
**KB Reference**: KB-10 (Implementation)  
**Issue Source**: docs/issues-combined.md #69

## Description

In the `waitForExit` spawn-backed path, a null exit code is mapped to 0 (success) on line 229: `exitCode: internal.exitCode ?? 0`. This is inconsistent with other code paths in the same file that map null to -1.

### Verdict: CONFIRMED

Three locations handle null exit codes in terminal-bridge.ts:
1. Line 134 (`on('exit')` handler): `internal.exitCode = code ?? -1` — maps null to **-1**
2. Line 204 (ACP `waitForExit` path): `exitResult.exitCode ?? -1` — maps null to **-1**
3. Line 229 (spawn `waitForExit` path): `internal.exitCode ?? 0` — maps null to **0**

Path #3 is inconsistent. Since `internal.exitCode` is set by the `on('exit')` handler (path #1) which already maps null to -1, the `?? 0` on line 229 would only trigger if `waitForExit` is called before the `exit` event fires and `proc.exitCode` is checked directly (line 236-238). In that early-exit path, `internal.exitCode = proc.exitCode` could be a raw number, making `?? 0` the fallback.

A signal-killed process (null exit code from Node.js) would incorrectly report success (exit code 0).

## Remediation

Change line 229 from `internal.exitCode ?? 0` to `internal.exitCode ?? -1` for consistency.

```typescript
resolve({
  exitCode: internal.exitCode ?? -1,
  stdout: internal.stdout.join(''),
  stderr: internal.stderr.join(''),
  durationMs: Date.now() - spawnedAt,
});
```
