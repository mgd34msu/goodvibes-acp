# ISS-048 — Tool call ID reuse across multi-attempt WRFC cycles

**Severity**: Major
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**KB Topic**: KB-06: Tool Call Uniqueness

## Original Issue
The `_toolCallId` method generates IDs as `wrfc_${phase}_${workId}` and caches them. In multi-attempt WRFC chains, the same `workId:review` key maps to the same cached ID. Per ACP spec: `toolCallId` must be unique within a session.

## Verification

### Source Code Check
Lines 254-261:
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
The cache key is `${workId}:${phase}`. The `chain-complete` handler (lines 222-231) cleans up entries for a workId, but during a multi-attempt chain (e.g., work -> review -> fix -> review), the second `review` phase for the same `workId` will find the cached ID from the first review attempt and reuse it.

Note: The `StateChangedPayload` includes an `attempt` field (line 48) but `_toolCallId` does not use it.

### ACP Spec Check
KB-06 line 93: `toolCallId: string; // Unique within session; agent-generated`
KB-06 line 621: `toolCallId is agent-generated; must be unique within a session (use nanoid/uuid)`

### Verdict: CONFIRMED
The caching mechanism reuses the same tool call ID for repeated phases within a WRFC chain. The `attempt` number is available in the event payload but not incorporated into the ID generation. This violates the ACP requirement for session-unique tool call IDs.

## Remediation
1. Include the attempt number in the tool call ID: `wrfc_${phase}_${attempt}_${workId}`
2. Clear stale entries from `_activeToolCalls` when a phase re-enters (i.e., when `state-changed` fires for a phase that already has a cached ID)
3. Alternatively, use `nanoid()` or `crypto.randomUUID()` for guaranteed uniqueness
