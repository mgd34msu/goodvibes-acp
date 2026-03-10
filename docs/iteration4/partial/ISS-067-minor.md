# ISS-067: IPC _request timeout does not clean up pending entry on write failure

**Severity**: Minor  
**File**: `src/extensions/mcp/transport.ts`  
**Lines**: 204-210  
**KB Reference**: KB-10 (Implementation)  
**Issue Source**: docs/issues-combined.md #67

## Description

The `_request` method sets up a pending entry with timeout before writing to stdin. If the stdin write fails silently (fire-and-forget on line 209), the pending entry remains in the map with an active timer. The issue claims this leads to double-reject.

### Verdict: PARTIAL

The write on line 209 (`this._process.stdin.write(...)`) is fire-and-forget — no callback to detect write failure. If the write fails silently:
- The pending entry stays in `_pending` with the timer active
- Eventually the timer fires and rejects, cleaning up properly
- If the process exits, `_rejectAll` fires and clears all entries

The double-reject scenario described is not actually possible because `_rejectAll` calls `this._pending.clear()` (line 229), so the timer's `_pending.delete(id)` is a no-op and the Promise is already settled.

However, the real issue is:
1. Write failures are undetected — the caller waits for the full timeout instead of failing fast
2. No error event is emitted for the write failure

## Remediation

1. Use the write callback to detect failures and reject immediately
2. Clean up the pending entry and timer on write failure

```typescript
this._process.stdin.write(JSON.stringify(msg) + '\n', 'utf8', (err) => {
  if (err) {
    const entry = this._pending.get(id);
    if (entry) {
      this._pending.delete(id);
      entry.reject(new Error(`MCP write failed: ${err.message}`));
    }
  }
});
```
