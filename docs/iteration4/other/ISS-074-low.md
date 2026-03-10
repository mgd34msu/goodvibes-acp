# ISS-074 — EventBus `handlerCount` omits prefix handlers
**Severity**: Low
**File**: `src/core/event-bus.ts`
**KB Topic**: KB-08: Extensibility

## Original Issue
Only iterates `_handlers`, missing `_prefixHandlers`. Gives inaccurate count after O(1) prefix optimization.

## Verification

### Source Code Check
`src/core/event-bus.ts` lines 320-326:
```
get handlerCount(): number {
  let count = 0;
  for (const set of this._handlers.values()) {
    count += set.size;
  }
  return count;
}
```
The getter only iterates `_handlers` and does not include `_prefixHandlers`. Any handlers registered via prefix patterns (e.g., `session:*`) would not be counted.

### ACP Spec Check
KB-08 discusses extensibility but does not define requirements for handler counting. This is an internal implementation accuracy issue, not a protocol compliance concern.

### Verdict: NOT_ACP_ISSUE
The handler count inaccuracy is a real code bug (confirmed in source), but it is not an ACP protocol compliance issue. KB-08 does not define requirements for internal handler counting.

## Remediation
1. Also iterate `_prefixHandlers` in the `handlerCount` getter.
2. This is an internal correctness fix, not an ACP compliance fix.
