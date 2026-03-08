# ISS-139: `Queue.restore()` does not validate `$schema` version

**Source**: `src/core/queue.ts` lines 188-193
**KB Reference**: KB-01 (Version Management)
**Severity**: Major

### Verdict: CONFIRMED

The `Queue.restore()` static method accepts a `SerializedQueue<T>` and creates a new `Queue` by iterating over `data.entries`. It never checks `data.$schema` against the module's `QUEUE_SCHEMA_VERSION` constant.

If the serialized format changes between versions (e.g., `entries` gains new fields or the priority scheme changes), `restore()` would silently produce a queue with corrupted or misinterpreted data. This is part of a broader pattern (see also ISS-138, ISS-162) where `restore()` paths skip version validation.

### Remediation

1. Add a version check at the top of `restore()`:
   ```typescript
   if (data.$schema !== QUEUE_SCHEMA_VERSION) {
     throw new Error(`Queue schema mismatch: expected ${QUEUE_SCHEMA_VERSION}, got ${data.$schema}`);
   }
   ```
2. Optionally support migration from older schema versions with a migration function
3. Apply this pattern consistently to all `restore()` methods across the codebase
