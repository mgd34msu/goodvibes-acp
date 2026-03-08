# Wave 2 — Agent 2: Config & State Machine Review

**Reviewer**: goodvibes:reviewer  
**Iteration**: 3  
**Date**: 2026-03-07  
**Scope**: `src/core/state-machine.ts`, `src/core/state-store.ts`, `src/core/versioned-store.ts`, `src/core/utils.ts`  
**KB Topics**: 02-initialization, 08-extensibility  
**ACP Spec**: https://agentclientprotocol.com/llms-full.txt  

---

## Score: 8.4/10 | Issues: 0 critical, 2 major, 4 minor, 2 nitpick

---

## Reality Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Files exist | PASS | All 4 source files present on disk |
| Exports used | PASS | All exports imported via `src/core/index.ts`; `StateMachine` used by `wrfc/machine.ts`; `StateStore` used by `acp/agent.ts`, `sessions/manager.ts`; `deepMerge` used by `state-store.ts`; `versioned-store` exports used by `config.ts` |
| Import chain valid | PASS | All modules reachable through `src/core/index.ts` -> `src/main.ts` |
| No placeholders | PASS | No TODO/FIXME/placeholder stubs found |
| Integration verified | PASS | All files are imported and actively used in the runtime |

---

## Issues

### Major

| # | File | Line(s) | KB Topic | Issue |
|---|------|---------|----------|-------|
| 1 | `src/core/state-store.ts` | 233-243 | 02-initialization | **`restore()` skips `$schema` version validation.** The method accepts any `SerializedState` and blindly loads it without checking whether `$schema` matches `STATE_SCHEMA_VERSION` ("1.0.0"). ACP KB-02 mandates protocol version negotiation where the agent MUST validate version compatibility before proceeding. If persisted state was serialized with a future schema version (e.g., after a code rollback), restoring it could silently corrupt state. **Fix**: Check `state.$schema` against `STATE_SCHEMA_VERSION` and throw or migrate when they differ. |
| 2 | `src/core/state-store.ts` | 233-243 | 08-extensibility | **`restore()` does not fire change events.** When state is restored from a snapshot, the method silently replaces all internal state via `this._state.clear()` + rebuild without calling `_notifyChange()`. Any `onChange` subscribers (e.g., the ACP extensions layer, analytics, or persistence hooks) will be unaware that state changed. This breaks the observable contract that `onChange` fires on every mutation. **Fix**: Fire change events for each key during restore, or fire a bulk "restore" event that subscribers can handle. |

### Minor

| # | File | Line(s) | KB Topic | Issue |
|---|------|---------|----------|-------|
| 3 | `src/core/state-machine.ts` | 243-250 | 02-initialization | **`can()` does not evaluate guards, but callers may expect it to.** The method checks if a transition exists structurally but ignores guard conditions. The JSDoc at line 240 states "Does NOT fire guards" but this is easy to miss. In an ACP initialization flow where capability guards determine valid transitions, `can()` returning `true` for a guarded-out transition could cause incorrect UI or logic branching. **Fix**: Either add a `canStrict()` that evaluates guards, or rename `can()` to `hasTransition()` to make the semantics unambiguous. |
| 4 | `src/core/state-machine.ts` | 156-165, 186-193 | 08-extensibility | **Async lifecycle hooks are fire-and-forget.** `onEnter`/`onExit` hooks that return Promises have their rejections caught and logged to `console.error`, but the transition proceeds regardless. If an extension hook (e.g., a `_goodvibes/status` notification emitter) fails during a state transition, the failure is silently swallowed. This makes it impossible for extension code to abort or retry a transition. **Fix**: Consider an option to make the state machine await hooks and propagate errors, or at minimum emit hook failures through a structured error channel rather than `console.error`. |
| 5 | `src/core/state-store.ts` | 257-265 | 08-extensibility | **`_notifyChange` swallows listener errors silently.** The empty `catch {}` block at line 261 means a failing onChange listener produces no diagnostic output at all. Per ACP KB-08, extension code attaches to protocol types via hooks; if a `_goodvibes/*` extension listener throws, there is zero observability. **Fix**: Log the error to `console.error` (matching the pattern used in `state-machine.ts`), or emit to a structured error handler. |
| 6 | `src/core/versioned-store.ts` | 31-39 | 02-initialization | **`isVersioned()` does not validate semver format.** The guard only checks that `$schema` is a string and `data` exists, but does not verify the string is a valid semver (e.g., it would accept `"banana"` as a valid schema version). ACP KB-02 defines protocol versions as integers and serialized schemas as semver strings. Allowing arbitrary strings could mask version mismatches. **Fix**: Add a basic semver format check (e.g., `/^\d+\.\d+\.\d+/`) or document that validation is the caller's responsibility. |

### Nitpick

| # | File | Line(s) | KB Topic | Issue |
|---|------|---------|----------|-------|
| 7 | `src/core/utils.ts` | 36 | 08-extensibility | **`deepMerge` skips `undefined` source values, preventing key deletion.** When `srcVal` is `undefined`, the key is not written to the result (line 36: `if (srcVal !== undefined)`). This means `StateStore.merge()` cannot be used to remove keys from nested objects. For extensibility scenarios where `_meta` fields need to be cleared, this is a limitation. **Fix**: Document this behavior explicitly, or add a sentinel value (e.g., `Symbol`) for deletion. |
| 8 | `src/core/state-machine.ts` | 370-378 | 02-initialization | **`restore()` does not validate that `data.current` is a valid state in the config.** If serialized data contains a state name that no longer exists in the config (e.g., after a code change removed a state), the restored machine will be in an invalid state with no transitions available. **Fix**: Validate `data.current` against `config.states` keys and throw if invalid. |

---

## Category Breakdown

| Category | Score | Deductions | Key Issues |
|----------|-------|------------|------------|
| Security | 10/10 | 0 | No secrets, no injection vectors, no external input handling |
| Error Handling | 7/10 | -3.0 | Silent error swallowing (#5), fire-and-forget async (#4) |
| Testing | N/A | — | Tests not in scope for this review |
| Organization | 9/10 | -1.0 | Clean separation, good barrel exports |
| Performance | 9/10 | -1.0 | History array shift() is O(n) but bounded by historyLimit |
| SOLID/DRY | 9/10 | -1.0 | Transition matching logic duplicated between `transition()` and `can()` |
| Naming | 9/10 | -1.0 | `can()` semantics are ambiguous (#3) |
| Maintainability | 8/10 | -2.0 | No version validation on restore (#1, #6, #8) |
| Documentation | 9/10 | -1.0 | Good JSDoc throughout, minor gap on guard behavior |
| Dependencies | 10/10 | 0 | Zero external deps, clean L1 layering |

---

## Recommendations

1. **This PR**: Add `$schema` validation to `StateStore.restore()` and `StateMachine.restore()` to prevent silent data corruption on version mismatches.
2. **This PR**: Add `console.error` logging to the empty `catch {}` in `StateStore._notifyChange()` for parity with `state-machine.ts` error handling.
3. **Follow-up**: Consider an `onError` callback mechanism for both `StateMachine` and `StateStore` to replace `console.error` with structured error reporting suitable for ACP extension observability.
4. **Follow-up**: Evaluate whether `deepMerge` should support explicit key deletion for `_meta` field management in ACP extensibility scenarios.
