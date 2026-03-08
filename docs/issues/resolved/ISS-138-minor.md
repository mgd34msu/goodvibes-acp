# ISS-138: `isVersioned()` does not validate semver format

**Source**: `src/core/versioned-store.ts` lines 31-39
**KB Reference**: KB-02 (Version Management)
**Severity**: Minor

### Verdict: PARTIAL

The `isVersioned()` type guard checks that `$schema` exists and is a string, and that `data` exists, but does not validate that `$schema` is a valid semver string. Values like `"banana"` or `""` pass the guard.

However, the function's JSDoc explicitly states: "Does NOT validate the schema string or the data shape." This is a **documented limitation**, and the function is a type guard (structural check), not a validator. The concern is valid -- callers may assume `$schema` is a valid version -- but the behavior matches its documented contract.

### Remediation

1. Add a separate `validateVersionedSchema()` function that checks semver format (e.g., `/^\d+\.\d+\.\d+$/`)
2. Call the validator in `restore()` paths where version comparison matters (e.g., `Queue.restore()`, `StateMachine.restore()`)
3. Keep `isVersioned()` as-is for structural checks where semver validity is not required
