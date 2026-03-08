# ISS-058 — `StateStore.restore()` skips `$schema` version validation

**Severity**: Major
**File**: `src/core/state-store.ts`
**KB Topic**: KB-02: Version Management

## Original Issue
The method accepts any `SerializedState` and blindly loads it without checking whether `$schema` matches `STATE_SCHEMA_VERSION`. If persisted state was serialized with an incompatible schema version, restoring it could silently corrupt state.

## Verification

### Source Code Check
The `snapshot()` method (line 221) writes `$schema: STATE_SCHEMA_VERSION` into the serialized output. The `SerializedState` interface (line 17-23) declares `$schema: string`.

However, `restore()` (lines 233-243) does:
```typescript
restore(state: SerializedState): void {
  this._assertNotDestroyed();
  this._state.clear();
  for (const [ns, nsData] of Object.entries(state.namespaces)) {
    const nsMap = new Map<string, unknown>();
    for (const [key, value] of Object.entries(nsData)) {
      nsMap.set(key, value);
    }
    this._state.set(ns, nsMap);
  }
}
```
No check of `state.$schema` against `STATE_SCHEMA_VERSION` (`'1.0.0'`, line 42).

### ACP Spec Check
KB-02 covers initialization and version negotiation. While it primarily discusses protocol version negotiation during `initialize`, the principle of version validation applies to any versioned data exchange. The `$schema` field exists specifically for migration support (per the interface comment), but the restore path ignores it.

### Verdict: CONFIRMED
The `restore()` method completely ignores the `$schema` field. The `snapshot()` method writes a version, and the `SerializedState` type includes `$schema`, but `restore()` never validates it. Loading state from an incompatible schema version could silently corrupt runtime state.

## Remediation
1. At the top of `restore()`, check `state.$schema` against `STATE_SCHEMA_VERSION`.
2. If versions don't match, either throw an error with a descriptive message, or invoke a migration function.
3. Consider adding a version compatibility check (e.g., semver-compatible) rather than strict equality, to allow backward-compatible schema changes.
