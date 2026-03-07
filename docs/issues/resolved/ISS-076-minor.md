# ISS-076: Ring buffer uses shift() — O(n) per emit degrades linearly

**Severity**: Minor
**File**: src/core/event-bus.ts
**Line(s)**: 174-176
**Topic**: Overview

## Issue Description
Ring buffer uses `shift()` — O(n) per emit. For high-frequency ACP streaming updates this degrades linearly. Use a circular buffer index or deque.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/01-overview.md (Prompt Turn Wire Example)
- **Spec Says**: During a prompt turn, agents stream multiple `session/update` notifications (message chunks, tool calls, tool call updates, plans, etc.). A typical turn can emit dozens to hundreds of updates. The internal event bus must handle this throughput efficiently.
- **Confirmed**: Yes
- **Notes**: This is a performance concern rather than a spec conformance issue. However, ACP's streaming-heavy design makes it architecturally relevant.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 173-175: `this._history.push(record)` followed by `if (this._history.length > this._historyLimit) { this._history.shift(); }`. `Array.shift()` is O(n) because it requires re-indexing all elements. With a typical history limit (e.g., 1000), every emit after the buffer is full copies ~1000 elements.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Replace the array-based ring buffer with a circular buffer using a write index: `this._history[this._writeIdx % this._historyLimit] = record; this._writeIdx++`
2. Alternative: use a deque/doubly-linked-list structure
3. If the history limit is small (<100), this may be acceptable — document the tradeoff
4. Benchmark with realistic ACP streaming workloads to quantify impact
