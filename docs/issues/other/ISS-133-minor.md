# ISS-133 — `activeCount()` Performs N+1 Store Lookups

**Severity**: Minor
**File**: src/extensions/agents/tracker.ts
**KB Topic**: TypeScript SDK

## Original Issue
`activeCount()` iterates all keys twice (get + filter) — N+1 store lookups.

## Verification

### Source Code Check
At lines 139-147 of `src/extensions/agents/tracker.ts`:
```typescript
activeCount(): number {
  return this._store
    .keys(NS)
    .filter((key) => {
      const m = this._store.get<AgentMetadata>(NS, key);
      return m?.status === 'spawned' || m?.status === 'running';
    })
    .length;
}
```
This fetches all keys via `keys(NS)` and then calls `this._store.get()` individually for each key inside the `filter`. This is indeed N+1 lookups (1 keys call + N get calls). Compare to the existing `_allMetadata()` private helper at lines 165-167:
```typescript
private _allMetadata(): AgentMetadata[] {
  return this._store.keys(NS).map((key) => this._store.get<AgentMetadata>(NS, key)!);
}
```
The `active()` method (lines 132-136) correctly uses `_allMetadata()` and then filters — one pass. `activeCount()` duplicates the pattern inefficiently.

### ACP Spec Check
This is an internal efficiency issue with no ACP spec relevance. The ACP spec does not define agent tracking data structures.

### Verdict: NOT_ACP_ISSUE
The issue is real — `activeCount()` does N+1 store lookups while `active()` (the sibling method) already uses the more efficient `_allMetadata()` helper. However, this is purely a code quality issue with no ACP compliance implications.

## Remediation
Replace `activeCount()` implementation to reuse `_allMetadata()`:
```typescript
activeCount(): number {
  return this._allMetadata().filter(
    (m) => m.status === 'spawned' || m.status === 'running'
  ).length;
}
```
This matches the pattern already used by `active()` and eliminates the N+1 lookup pattern.
