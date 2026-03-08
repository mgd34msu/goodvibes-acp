# ISS-045 — _pendingWarnings map is write-only dead code

**Severity**: Minor
**File**: `src/plugins/analytics/engine.ts`
**KB Topic**: KB-08: Extension Methods

## Original Issue
The `_pendingWarnings` map is populated when budget thresholds are crossed but is never read, consumed, or cleared anywhere. No public method exposes pending warnings and no notification is emitted. This is dead state giving a false impression that alerts are tracked.

## Verification

### Source Code Check
Line 48 declares:
```typescript
private readonly _pendingWarnings = new Map<string, string[]>();
```
Lines 132, 141, 147 call `_pendingWarnings.set()` when budget thresholds are crossed (warning threshold, alert threshold, and 100%).

A codebase-wide grep for `_pendingWarnings.get`, `_pendingWarnings.has`, `_pendingWarnings.forEach`, `_pendingWarnings.entries`, `_pendingWarnings.values`, and `consumeWarnings` returns zero results. The map is only ever written to, never read.

### ACP Spec Check
KB-08 defines extension methods including `_goodvibes/analytics`. While the spec does not specifically require warning notifications, dead state that implies alert tracking without actually delivering alerts is misleading and a code quality issue.

### Verdict: CONFIRMED
The `_pendingWarnings` map is strictly write-only. No method reads, consumes, or clears it. No notification is emitted when warnings are recorded. This is dead code.

## Remediation
Either:
1. Expose a `consumeWarnings(sessionId: string): string[]` method that returns and clears pending warnings, and integrate it into the analytics response or session update flow
2. Or remove the `_pendingWarnings` map entirely and integrate threshold notifications directly into `session/update` notifications via the event bus
