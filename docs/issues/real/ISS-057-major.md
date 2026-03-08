# ISS-057 — `DirectiveQueue` has no session isolation — all sessions share one queue

**Severity**: Major
**File**: `src/extensions/directives/queue.ts`
**KB Topic**: KB-03: Session Independence

## Original Issue
Sessions are independent conversation contexts per ACP. A single shared `DirectiveQueue` with no session partitioning means `session/cancel` on one session could inadvertently affect directives from another session.

## Verification

### Source Code Check
`DirectiveQueue` (lines 85-268) maintains a single `Queue<Directive>` and a single `_pending` buffer. The `drain(filter?)` method (line 145) accepts an optional `DirectiveFilter`, but `DirectiveFilter` (src/types/directive.ts, lines 72-80) only supports filtering by `action`, `workId`, `target`, and `minPriority` — no `sessionId`.

The `clear()` method (line 204) clears the entire queue without session scoping.

### ACP Spec Check
KB-03 establishes that sessions are independent: "Multiple independent sessions can coexist with the same Agent." This implies that operations on one session must not affect another. A shared, unpartitioned directive queue violates this independence guarantee.

### Verdict: CONFIRMED
The `DirectiveQueue` is a single shared queue with no session partitioning. The `DirectiveFilter` type lacks a `sessionId` field. Operations like `clear()` and `drain()` cannot be scoped to a single session, meaning cross-session interference is possible.

## Remediation
1. Add `sessionId?: string` to `DirectiveFilter`.
2. Update `buildPredicate` to filter on `sessionId` when provided.
3. Either maintain per-session queues (Map<sessionId, Queue>) or enforce `sessionId` filtering in `drain()`, `clear()`, and `process()`.
4. Depends on ISS-056 (adding `sessionId` to the `Directive` type).
