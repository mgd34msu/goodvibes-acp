# ISS-035: Tool Call ID reuse across WRFC retry cycles

**Severity**: Major
**Category**: KB-06 Tool Calls
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 263-271

## Description

`_toolCallId()` generates deterministic IDs as `wrfc_${phase}_${workId}` and caches them in `_activeToolCalls`. On WRFC retry cycles, the second review phase for the same work unit produces the same key (`${workId}:${phase}`), which returns the cached ID. This violates the ACP requirement for unique tool call IDs within a session.

### Verdict: CONFIRMED

Source code shows:
```typescript
private _toolCallId(workId: string, phase: string): string {
    const key = `${workId}:${phase}`;
    let id = this._activeToolCalls.get(key);
    if (!id) {
      id = `wrfc_${phase}_${workId}`;
      this._activeToolCalls.set(key, id);
    }
    return id;
}
```
The cache lookup means the first invocation creates the ID and all subsequent invocations for the same work+phase return the same ID. No attempt counter or randomization exists.

## Remediation

1. Append an attempt counter to the ID: `wrfc_${phase}_${workId}_${attempt}`.
2. Alternatively, generate a fresh UUID per phase invocation instead of caching.
3. Clear the cache entry when a phase completes so retry cycles get fresh IDs.

## ACP Reference

KB-06: Tool call IDs must be unique within a session to prevent client-side confusion.
