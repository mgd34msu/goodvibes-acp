# ISS-081: Spawn fallback output concatenates stdout+stderr instead of interleaving

**Source**: `src/extensions/acp/terminal-bridge.ts` line 179  
**KB Reference**: KB-07 (Terminal Output)  
**Severity**: Minor

## Description

The spawn fallback path in `AcpTerminal.currentOutput()` concatenates stdout and stderr sequentially (`internal.stdout.join('') + internal.stderr.join('')`) instead of interleaving them in arrival order. This means error messages appear after all stdout rather than at the point they occurred.

## Evidence

Code at line 179:
```typescript
return {
  output: internal.stdout.join('') + internal.stderr.join(''),
  exitCode: internal.exitCode,
};
```

The code comments explicitly acknowledge this limitation and suggest the fix.

KB-07 specifies that `terminal/output` returns combined output in a single `output` field, matching real terminal behavior where stdout and stderr are interleaved.

### Verdict: CONFIRMED

The code concatenates stdout after stderr instead of interleaving in arrival order, contradicting KB-07's expectation of combined terminal output matching real terminal behavior.

## Remediation

1. Replace the separate `stdout: string[]` and `stderr: string[]` buffers with a single `outputChunks: string[]` buffer in the `InternalHandle` type.
2. Push both stdout and stderr data chunks into `outputChunks` as they arrive (in the `spawn` data event handlers).
3. Update `currentOutput()` to join the single buffer: `output: internal.outputChunks.join('')`.
4. This preserves arrival order and matches the ACP terminal output behavior.
