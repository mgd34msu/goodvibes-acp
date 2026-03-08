# ISS-118 — Dashboard `getSummary` copies all entries into single array — memory pressure

**Severity**: Minor
**File**: `src/plugins/analytics/dashboard.ts`
**KB Topic**: KB-08: Performance

## Original Issue
`allEntries.push(...session.entries)` spreads every entry from every session, sorts, then slices to 20. For long-running agents, this creates unnecessary memory pressure.

## Verification

### Source Code Check
At lines 29-34:
```typescript
const allEntries: TokenUsageEntry[] = [];
...
for (const session of this._store.sessions.values()) {
  ...
  allEntries.push(...session.entries);
```
Then at lines 57-59:
```typescript
const recentEntries = allEntries
  .sort((a, b) => b.timestamp - a.timestamp)
  .slice(0, recentEntriesLimit);
```
This copies ALL entries from ALL sessions into a single array, sorts the entire array, then keeps only the first 20 (default). For an agent with thousands of tool calls across multiple sessions, this creates a large temporary array that is mostly discarded.

### ACP Spec Check
KB-08 does not address internal performance requirements. This is purely an implementation efficiency concern. ACP defines the wire format for analytics responses but not the internal aggregation strategy.

### Verdict: NOT_ACP_ISSUE
The memory pressure concern is valid from a code quality perspective, but it has no ACP protocol implications. The dashboard is an internal aggregation function. ACP does not specify how analytics data should be collected or aggregated internally.
