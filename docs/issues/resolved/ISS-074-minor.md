# ISS-074 — Spawn-Backed Terminal Drops All Stderr Output

**Severity**: Minor
**File**: src/extensions/acp/terminal-bridge.ts:169-173
**KB Topic**: Terminal Methods — `terminal/output` (07-filesystem-terminal.md)

## Original Issue
The spawn-backed `output()` method only returns `internal.stdout.join('')`. Stderr chunks are collected but never included in the output, silently dropping all stderr.

## Verification

### Source Code Check
Lines 169-173 of `src/extensions/acp/terminal-bridge.ts` confirm the issue:

```typescript
// Spawn-backed: combine buffered stdout
return {
  output: internal.stdout.join(''),
  exitCode: internal.exitCode,
};
```

Only `internal.stdout` is joined and returned. The `internal.stderr` array (which is populated elsewhere in the spawn handler) is completely ignored.

### ACP Spec Check
KB-07 (07-filesystem-terminal.md lines 281-285) defines the `terminal/output` response with a single `output` field containing "all terminal output." The ACP spec does not distinguish between stdout and stderr — it expects combined terminal output in the `output` field, similar to how a real terminal interleaves stdout and stderr.

### Verdict: CONFIRMED
The spawn-backed fallback only returns stdout in the `output` field, completely dropping stderr. This creates a behavioral inconsistency: ACP-backed terminals return whatever the client provides (typically combined output), while spawn-backed terminals silently lose all stderr content. Error messages, warnings, and diagnostic output written to stderr are invisible.

## Remediation
1. Combine stdout and stderr in the returned output: `output: [...internal.stdout, ...internal.stderr].join('')`
2. Ideally, interleave stdout and stderr in arrival order rather than concatenating them sequentially — this requires storing chunks with timestamps or in a single combined buffer
3. Consider refactoring the spawn handler to push both stdout and stderr chunks into a single `output` array in arrival order
