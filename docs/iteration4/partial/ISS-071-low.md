# ISS-071 — stdout/stderr not interleaved temporally in terminal output
**Severity**: Low
**File**: `src/extensions/acp/terminal-bridge.ts`
**KB Topic**: KB-10: Implementation

## Original Issue
Concatenates all stdout then all stderr, losing temporal order. KB-10 reference uses combined buffer.

## Verification

### Source Code Check
`src/extensions/acp/terminal-bridge.ts` line 179:
```
output: internal.stdout.join('') + internal.stderr.join(''),
```
The code concatenates all buffered stdout followed by all buffered stderr. Comments at lines 173-177 acknowledge this limitation and suggest refactoring to a single combined buffer for interleaved order.

### ACP Spec Check
KB-07 defines `terminal/output` response as a single `output` field. The spec does not explicitly mandate temporal interleaving of stdout/stderr — it simply expects a combined `output` string. The current implementation does produce a combined string, but temporal ordering is lost.

### Verdict: PARTIAL
The code produces a combined `output` field as required by KB-07, but loses temporal ordering between stdout and stderr. The ACP spec does not explicitly require temporal interleaving, making this an implementation quality concern rather than a strict protocol violation. The code comments already acknowledge this limitation.

## Remediation
1. Refactor to push both stdout and stderr chunks into a single combined buffer as they arrive, preserving temporal order.
2. This is a quality improvement, not a compliance fix.
