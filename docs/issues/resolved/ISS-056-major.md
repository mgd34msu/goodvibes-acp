# ISS-056 — Directives have no `sessionId` field — cannot be scoped to ACP sessions

**Severity**: Major
**File**: `src/types/directive.ts`
**KB Topic**: KB-03: Session Isolation

## Original Issue
The `Directive` type has `workId` and `target` but no `sessionId`, making it impossible to cancel or isolate directives per ACP session. All sessions share one queue.

## Verification

### Source Code Check
At lines 29-46, the `Directive` type is:
```typescript
export type Directive = {
  id: string;
  action: DirectiveAction;
  workId: string;
  target?: string;
  task?: string;
  priority: DirectivePriority;
  createdAt: number;
  meta?: Record<string, unknown>;
};
```
No `sessionId` field exists.

### ACP Spec Check
KB-03 states: "Sessions represent a conversation thread between Client and Agent. Each session maintains its own context, conversation history, and state. Multiple independent sessions can coexist with the same Agent." Session independence requires that operations can be scoped to individual sessions.

### Verdict: CONFIRMED
The `Directive` type has no `sessionId` field. Since ACP sessions are independent contexts that can coexist, directives must be attributable to specific sessions for proper isolation. Without `sessionId`, there is no way to cancel, filter, or isolate directives per session.

## Remediation
1. Add `sessionId: string` to the `Directive` type.
2. Populate `sessionId` at directive creation time.
3. Use `sessionId` in `DirectiveQueue` filtering (see also ISS-057).
