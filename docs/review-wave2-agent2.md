# Wave 2 Review — Agent 2: StateMachine & Stores

**Reviewer:** ACP Compliance Review Agent (Iteration 4, Phase 2)  
**Scope:** `src/core/state-machine.ts`, `src/core/state-store.ts`, `src/core/versioned-store.ts`, `src/core/queue.ts`  
**KB References:** `03-sessions.md` (session lifecycle/persistence), `08-extensibility.md` ($schema conventions), `10-implementation-guide.md` (state management patterns)  
**Known Prior Issues:** restore() bypasses _notifyChange (FIXED), restore() ignores $schema (FIXED in StateStore), can() ignores guards, state validation

---

## Issues

### 1. StateMachine.can() Ignores Guards — Misleading for Lifecycle Checks

**File:** `src/core/state-machine.ts`, line 243-250  
**KB Topic:** Session lifecycle (03-sessions.md) — session state transitions must respect guards  
**Severity:** Medium

`can()` explicitly skips guard evaluation (documented in JSDoc line 238). When used for ACP session lifecycle (e.g., "can this session accept a prompt?"), a `true` return does not mean the transition will succeed. Callers must call `transition()` and check the boolean, making `can()` a footgun for any code that uses it as a pre-check before performing expensive work.

**Recommendation:** Add a `canStrict(event)` that evaluates guards, or add an optional `{ checkGuards: boolean }` parameter to `can()`.

---

### 2. StateMachine.restore() Does Not Validate $schema Version

**File:** `src/core/state-machine.ts`, line 370-386  
**KB Topic:** Schema versioning for persistence (08-extensibility.md)  
**Severity:** Medium

`StateStore.restore()` correctly validates `$schema` against `STATE_SCHEMA_VERSION` and throws on mismatch (lines 236-240). However, `StateMachine.restore()` accepts any `$schema` value without validation. If a serialized state machine from a future or incompatible schema version is loaded, it will silently produce undefined behavior.

**Recommendation:** Add schema version validation matching the pattern in `StateStore.restore()`.

---

### 3. StateMachine Async Hooks Are Fire-and-Forget

**File:** `src/core/state-machine.ts`, lines 160-165, 173-176, 188-192, 199-203, 222-227  
**KB Topic:** Session lifecycle reliability (03-sessions.md — session state consistency)  
**Severity:** Medium

`onEnter`, `onExit`, and `onTransition` handlers that return Promises have their rejections caught but their resolutions are not awaited. The `transition()` method returns `boolean` synchronously while async hooks may still be running. For ACP session lifecycle hooks (e.g., persisting session state on exit, cleaning up MCP connections), this means the caller has no guarantee that side effects have completed before proceeding.

**Recommendation:** Consider an async `transitionAsync()` variant that awaits all hooks, or document the fire-and-forget contract prominently so L2/L3 consumers are aware.

---

### 4. StateMachine.reset() Does Not Fire Lifecycle Hooks

**File:** `src/core/state-machine.ts`, lines 341-345  
**KB Topic:** Session lifecycle (03-sessions.md — session cleanup)  
**Severity:** Low

`reset()` directly sets `_current` to `initial` and clears history without firing `onExit` for the current state or `onEnter` for the initial state. If reset is used during ACP session teardown, registered cleanup hooks will be silently skipped.

**Recommendation:** Either fire lifecycle hooks during reset, or rename to `hardReset()` and add a `reset()` that transitions properly.

---

### 5. StateMachine.context() Returns Mutable Reference

**File:** `src/core/state-machine.ts`, lines 267-269  
**KB Topic:** State integrity (10-implementation-guide.md — state management)  
**Severity:** Low

`context()` returns the internal `_context` reference directly (the JSDoc at line 263 acknowledges this). External code can mutate context without going through `updateContext()`, bypassing any future change tracking or validation. `serialize()` correctly copies context (line 356), but runtime access is unprotected.

**Recommendation:** Return a frozen shallow copy, or accept the trade-off and ensure all L2/L3 consumers use `updateContext()` exclusively.

---

### 6. Queue.restore() Does Not Validate $schema Version

**File:** `src/core/queue.ts`, lines 188-194  
**KB Topic:** Schema versioning for persistence (08-extensibility.md)  
**Severity:** Medium

Same pattern as StateMachine — `Queue.restore()` accepts serialized data without checking `$schema` against `QUEUE_SCHEMA_VERSION`. Inconsistent with `StateStore.restore()` which correctly validates.

**Recommendation:** Add `if (data.$schema !== QUEUE_SCHEMA_VERSION) throw new Error(...)` before restoring entries.

---

### 7. Queue Has No Size Limit or Backpressure

**File:** `src/core/queue.ts`, entire class  
**KB Topic:** Resource management (10-implementation-guide.md — runtime stability)  
**Severity:** Low

The Queue has no `maxSize` option. In an ACP runtime processing directives, prompts, or agent tasks, an unbounded queue can grow without limit if producers outpace consumers. `StateMachine` has `historyLimit` (line 41) for its history buffer, but Queue has no equivalent.

**Recommendation:** Add an optional `maxSize` config with configurable overflow behavior (reject, drop-oldest, or callback).

---

### 8. Queue.restore() Re-enqueues Items (Sequence Numbers Reset)

**File:** `src/core/queue.ts`, lines 188-194  
**KB Topic:** State persistence fidelity (03-sessions.md — session/load must replay faithfully)  
**Severity:** Low

`Queue.restore()` calls `enqueue()` for each item, which assigns new sequence numbers via `_seqCounter++`. While items with different priorities will be correctly ordered, the internal `seq` values will differ from the original. This is fine for correctness but means serialized-then-restored queues are not byte-identical to the original — relevant if any code compares or hashes queue state.

**Recommendation:** Minor — document that restore produces semantically equivalent but not identical internal state.

---

### 9. VersionedStore isVersioned() Does Not Validate $schema Format

**File:** `src/core/versioned-store.ts`, lines 31-39  
**KB Topic:** Schema versioning conventions (08-extensibility.md)  
**Severity:** Low

`isVersioned()` checks that `$schema` is a string but does not validate it as a semver string (the JSDoc at line 29 notes this). An object with `{ $schema: "", data: null }` passes the guard. While this is intentionally loose for flexibility, it means consumers must validate the version string themselves after unwrapping.

**Recommendation:** Minor — either add optional semver validation or document that callers must validate version format.

---

### 10. StateStore.clear() Fires Individual Change Events Before Deletion

**File:** `src/core/state-store.ts`, lines 174-192  
**KB Topic:** State consistency during bulk operations  
**Severity:** Low

When clearing a namespace, `clear()` fires `_notifyChange` for each key individually (with `newValue: undefined`) before calling `this._state.delete(namespace)`. During notification, the namespace still exists in `_state` with its remaining keys. This is correct behavior but means listeners see a partially-cleared namespace mid-iteration. For ACP session teardown with many state keys, this could trigger expensive intermediate reactions.

**Recommendation:** Consider a batch notification pattern (e.g., `onBulkChange`) or fire notifications after deletion is complete.

---

## Summary

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | state-machine.ts:243 | `can()` ignores guards — misleading for lifecycle | Medium |
| 2 | state-machine.ts:370 | `restore()` skips $schema validation | Medium |
| 3 | state-machine.ts:160 | Async hooks fire-and-forget | Medium |
| 4 | state-machine.ts:341 | `reset()` skips lifecycle hooks | Low |
| 5 | state-machine.ts:267 | `context()` returns mutable reference | Low |
| 6 | queue.ts:188 | `restore()` skips $schema validation | Medium |
| 7 | queue.ts (class) | No size limit / backpressure | Low |
| 8 | queue.ts:188 | `restore()` resets sequence numbers | Low |
| 9 | versioned-store.ts:31 | `isVersioned()` no semver validation | Low |
| 10 | state-store.ts:174 | `clear()` fires individual events mid-deletion | Low |

**Prior issues status:** restore() bypassing _notifyChange — FIXED. restore() ignoring $schema in StateStore — FIXED. can() ignoring guards — STILL PRESENT. State validation on restore in StateMachine — FIXED (state validated, but $schema still not validated).

## Overall Score: 7.5 / 10

The core primitives are well-structured with clean APIs, proper TypeScript generics, and good separation of concerns. The StateStore has been improved with $schema validation and change notifications on restore. However, the StateMachine and Queue still lack $schema validation on restore (inconsistent with StateStore), `can()` remains misleading without guard evaluation, and the fire-and-forget async hook pattern creates reliability gaps for ACP session lifecycle management. The issues are concentrated in persistence safety and lifecycle hook completeness rather than fundamental design problems.
