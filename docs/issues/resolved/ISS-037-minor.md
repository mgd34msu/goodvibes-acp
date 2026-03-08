# ISS-037 — O(k) prefix wildcard matching on every emit call

**Severity**: Minor
**File**: `src/core/event-bus.ts`
**KB Topic**: KB-01: Streaming Notifications

## Original Issue
Every call to `emit()` iterates over ALL registered handler keys to check for prefix wildcard matches (e.g., `session:*`). This is O(k) where k is the total number of distinct subscriptions. ACP's `session/update` notification fires at high frequency during streaming.

## Verification

### Source Code Check
Lines 198-205 of `event-bus.ts`:
```typescript
// Prefix wildcards e.g. 'session:*' matches 'session:started'
for (const [key, handlerSet] of this._handlers) {
  if (key !== type && key !== '*' && key.endsWith(':*')) {
    const prefix = key.slice(0, -1); // 'session:'
    if (type.startsWith(prefix)) {
      sets.push(handlerSet);
    }
  }
}
```
This iterates over every entry in `this._handlers` on every `emit()` call. For prefix wildcard matching, it checks each key to see if it ends with `:*` and if the event type starts with the prefix.

### ACP Spec Check
KB-01 (Overview) describes session/update notifications used for streaming. These fire at high frequency during agent message generation. The O(k) scan on every emit is a performance concern but does not violate the ACP protocol specification itself.

### Verdict: CONFIRMED
The O(k) iteration is present and could become a performance bottleneck with many registered subscriptions during high-frequency streaming. While not a protocol compliance issue, it is a valid implementation quality concern for ACP streaming workloads.

## Remediation
1. At subscription time, separate prefix wildcard subscriptions into a dedicated `Map<string, Set<EventHandler>>` keyed by the prefix (e.g., `'session:'`).
2. On emit, extract the event type's prefix (everything before the last `:`) and check this map directly — O(1) lookup instead of O(k) scan.
3. Keep the current iteration only as a fallback for complex patterns if needed.
