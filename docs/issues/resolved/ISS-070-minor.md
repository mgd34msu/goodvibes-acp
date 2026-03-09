# ISS-070: Shell injection risk in terminal spawn fallback

**Severity**: Minor  
**File**: `src/extensions/acp/terminal-bridge.ts`  
**Lines**: 109-115  
**KB Reference**: KB-05 (Permissions)  
**Issue Source**: docs/issues-combined.md #70

## Description

The spawn fallback path uses `shell: true` with a raw command string and no input sanitization for shell metacharacters. This creates a shell injection risk if the command string contains user-controlled input.

### Verdict: CONFIRMED

Lines 109-115:
```typescript
const useShell = true;
const proc = spawn(command, [], {
  cwd: cwd ?? this.cwd,
  shell: useShell,
  stdio: 'pipe',
  env: env ? { ...process.env, ...env } : process.env,
});
```

The code acknowledges the risk in comments (lines 100-107): "slightly lower security due to shell injection risk if command is user-controlled. Callers must sanitize untrusted command input." However, there is no actual sanitization or validation performed. The `TerminalCreateOptions` interface accepts a bare `command` string.

KB-05 defines a `shell` permission type that should gate shell command execution. The spawn fallback does not integrate with the permission system.

Note: The use of `shell: true` is somewhat justified because `TerminalCreateOptions.command` is a bare string that may contain pipes, redirects, and other shell features. However, the lack of any sanitization or permission gating makes this a real risk.

## Remediation

1. **Minimum**: Validate/escape shell metacharacters in the command string before spawning
2. **Better**: Split command into `[executable, ...args]` using a shell parser and use `shell: false`
3. **Best**: Integrate with the PermissionGate to require `shell` permission before spawning
4. Document that callers MUST gate through PermissionGate before calling `create()`

```typescript
// Option 1: Basic metacharacter validation
const DANGEROUS_CHARS = /[;&|`$(){}\[\]<>!]/;
if (DANGEROUS_CHARS.test(command) && !opts.allowShellFeatures) {
  throw new Error('Command contains shell metacharacters. Use allowShellFeatures or split into args.');
}
```
