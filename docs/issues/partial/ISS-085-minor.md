# ISS-085: console.warn used instead of console.error for ACP diagnostic output

**Source**: `src/extensions/lifecycle/daemon.ts` line 230, `src/extensions/lifecycle/shutdown.ts` line 116  
**KB Reference**: KB-02 (Diagnostic Output)  
**Severity**: Minor

## Description

`console.warn` is used in two places instead of `console.error`. KB-02 specifies that all agent diagnostic output should go to stderr (not stdout), and the codebase convention is to use `console.error` consistently.

## Evidence

`daemon.ts:230`:
```typescript
console.warn('[DaemonManager] No onConnection handler configured -- refusing connection from ' + socket.remoteAddress + ':' + socket.remotePort);
```

`shutdown.ts:116`:
```typescript
console.warn(`[ShutdownManager] Warning during shutdown of "${entry.name}": ${message}`);
```

KB-02 states: "Agent logs client capabilities to stderr (not stdout) for debugging." The rest of the codebase uses `console.error` for diagnostic output.

### Verdict: PARTIAL

Both `console.warn` and `console.error` write to stderr in Node.js/Bun, so this is not a protocol violation. However, it is a consistency issue. The rest of the codebase uses `console.error` for all diagnostic output, and mixing `console.warn` creates inconsistency in log formatting (some runtimes prepend different prefixes).

## Remediation

1. Replace `console.warn` with `console.error` in `daemon.ts:230`.
2. Replace `console.warn` with `console.error` in `shutdown.ts:116`.
3. Both are simple find-and-replace changes with no behavioral impact beyond consistency.
