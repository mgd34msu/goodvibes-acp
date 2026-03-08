# ISS-128 — `DirectiveQueue.process()` silently drops reentrancy without notification

**Severity**: Minor
**File**: `src/extensions/directives/queue.ts`
**Lines**: 227
**KB Topic**: KB-04: Cancellation

## Original Issue
When `process()` is already running and called again (e.g., from `session/cancel`), it silently returns `[]`. The caller has no indication directives were not processed.

## Verification

### Source Code Check
Confirmed at queue.ts line 227:
```typescript
if (this._processing) return []; // prevent reentrancy
```

The reentrancy guard returns an empty array silently. The caller receives the same return type (`DirectiveResult[]`) as a successful call that processed zero directives, making it impossible to distinguish "no directives to process" from "blocked by reentrancy."

### ACP Spec Check
KB-04 discusses cancellation and turn lifecycle. The reentrancy guard is an internal implementation concern rather than an ACP wire-protocol issue. The ACP protocol does not define how agent-internal directive queues should handle concurrent access.

However, if `session/cancel` triggers a `process()` call while a previous prompt turn is still processing, the silent drop could mean cancellation directives are lost.

### Verdict: PARTIAL
The silent reentrancy guard is confirmed in source. This is a valid code quality and reliability concern — callers cannot distinguish a reentrancy-blocked call from a normal empty queue — but it is not directly an ACP protocol violation. The concern about cancellation directives being dropped is valid but depends on how the queue is invoked from the session/cancel flow.

## Remediation
1. Log a warning when the reentrancy guard fires: `console.warn('[DirectiveQueue] process() skipped — already processing')`.
2. Optionally return a sentinel value or throw a specific error to distinguish reentrancy from empty queue.
3. Consider whether queued directives from a `session/cancel` need special handling (e.g., a separate cancel path that interrupts the current processing loop).
