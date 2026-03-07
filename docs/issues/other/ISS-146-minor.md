# ISS-146 — PriorityQueue Uses O(n) Linear Scan on Enqueue

**Severity**: Minor
**File**: src/core/queue.ts
**KB Topic**: Overview

## Original Issue
O(n) insertion on every enqueue — linear scan for priority position. Use binary search or heap for large queues.

## Verification

### Source Code Check
Lines 70–80 of `src/core/queue.ts`:

```typescript
let insertAt = this._entries.length;
for (let i = 0; i < this._entries.length; i++) {
  const existing = this._entries[i];
  if (
    entry.priority > existing.priority ||
    (entry.priority === existing.priority && entry.seq < existing.seq)
  ) {
    insertAt = i;
    break;
  }
}
this._entries.splice(insertAt, 0, entry);
```

This is a linear scan (O(n)) to find the insertion position, followed by `Array.splice` which is also O(n) due to element shifting. Total: O(n) per enqueue. For small queues (typical in this runtime) the cost is negligible, but under high throughput the quadratic behavior (O(n) × n enqueues = O(n²)) could degrade performance.

### ACP Spec Check
The ACP spec defines no requirements for internal queue performance. This is an L1 core utility implementation concern with no ACP protocol compliance implications.

### Verdict: NOT_ACP_ISSUE
The code has the problem described. The O(n) enqueue is a genuine performance concern at scale, but is functionally correct and has no bearing on ACP protocol compliance.

## Remediation
For the current use cases (small queues), the linear scan is acceptable. If queue sizes are expected to grow:

1. **Binary search**: Replace the linear scan with a binary search for insertion position — O(log n) scan but still O(n) splice.
2. **Min-heap**: Replace the array with a heap-based priority queue — O(log n) enqueue and dequeue, O(1) peek.
3. **Short-term**: Add a comment documenting the O(n) behavior and the queue size at which it becomes a concern.
