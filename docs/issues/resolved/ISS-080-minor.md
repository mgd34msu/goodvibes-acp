# ISS-080 — `shell: true` in spawn fallback creates shell injection risk
**Severity**: Minor
**File**: `src/extensions/acp/terminal-bridge.ts`
**KB Topic**: KB-07: Security

## Original Issue
The spawn fallback uses `shell: true` because `command` is a bare string. No input sanitization at the bridge layer.

## Verification

### Source Code Check
Lines 100-115 of `terminal-bridge.ts`:
```typescript
const useShell = true; // bare command strings may need shell interpretation
const proc = spawn(command, [], {
  cwd: cwd ?? this.cwd,
  shell: useShell,
  stdio: 'pipe',
  env: env ? { ...process.env, ...env } : process.env,
});
```
The code uses `shell: true` with a bare command string. The comment acknowledges the security tradeoff: "slightly lower security due to shell injection risk if command is user-controlled." No sanitization is performed at the bridge layer.

### ACP Spec Check
KB-07 defines `terminal/create` with a `command` parameter as a plain string. The spec does not mandate shell vs. non-shell execution. However, `shell: true` allows shell metacharacters (`;`, `|`, `&&`, `$()`, etc.) to be interpreted, creating injection risk if the command originates from untrusted input (e.g., LLM-generated commands).

### Verdict: CONFIRMED
The use of `shell: true` without input sanitization is a genuine security concern. While the code comments acknowledge the risk and note that "callers must sanitize untrusted command input," no sanitization is enforced at this layer. In an agent context, commands may originate from LLM output, which should be treated as untrusted.

## Remediation
1. Parse the command string into `[executable, ...args]` and use `shell: false` where possible.
2. If shell features (pipes, redirects) are needed, implement a whitelist of allowed shell metacharacters or use a restricted shell.
3. At minimum, add basic command validation (e.g., reject commands containing `$()`, backticks, or semicolons).
4. Document the security boundary: which layer is responsible for sanitizing commands before they reach the terminal bridge.
