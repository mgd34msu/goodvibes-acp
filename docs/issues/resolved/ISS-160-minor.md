# ISS-160: `MemoryManager.save()` does not validate store integrity before writing

**Source**: `src/extensions/memory/manager.ts` lines 195-202
**KB Reference**: KB-03 (Persistence)
**Severity**: Minor

## Issue Description
`save()` writes whatever is in `_store` without validation. Corrupted state is persisted and breaks future `load()` calls.

### Verdict: CONFIRMED

The `save()` method at lines 195-202 directly serializes `this._store` via `JSON.stringify` and writes to disk with no validation. If `_store` is corrupted (e.g., unexpected types, missing required arrays, circular references), the corrupted state is persisted. A subsequent `load()` will either fail to parse or load invalid data, propagating the corruption.

## Remediation
1. Add a lightweight validation before writing:
   ```typescript
   private _validateStore(store: MemoryStore): void {
     if (!Array.isArray(store.decisions)) throw new Error('Invalid store: decisions must be an array');
     if (!Array.isArray(store.patterns)) throw new Error('Invalid store: patterns must be an array');
     if (!Array.isArray(store.failures)) throw new Error('Invalid store: failures must be an array');
     if (!Array.isArray(store.preferences)) throw new Error('Invalid store: preferences must be an array');
   }
   ```
2. Call `this._validateStore(this._store)` at the start of `save()`
3. Consider writing to a temp file first and renaming (atomic write) to prevent partial writes on crash
