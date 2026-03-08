# ISS-059 — `StateStore.restore()` does not fire change events

**Severity**: Major
**File**: `src/core/state-store.ts`
**KB Topic**: KB-08: Observable Contract

## Original Issue
When state is restored from a snapshot, the method silently replaces all internal state without calling `_notifyChange()`. Any `onChange` subscribers (ACP extensions, analytics, persistence hooks) will be unaware that state changed.

## Verification

### Source Code Check
The `restore()` method (lines 233-243) clears `this._state` and repopulates it from the snapshot, but never calls `_notifyChange()`. In contrast:
- `set()` (line 96) calls `this._notifyChange(...)` after every change
- `delete()` (line 112) calls `this._notifyChange(...)` after every deletion
- `clear()` (line 180, 187) calls `this._notifyChange(...)` for each cleared key

`restore()` bypasses the notification mechanism entirely.

### ACP Spec Check
KB-08 describes extension notifications and observable patterns. The `_goodvibes/state` extension method allows clients to query state. If state is restored without firing change events, any subscribers (including ACP extensions tracking state changes, analytics hooks, or persistence layers) will have stale views of the state.

### Verdict: CONFIRMED
The `restore()` method replaces all state without firing any change events. Every other mutation method (`set`, `delete`, `clear`) fires `_notifyChange`. This breaks the observable contract — subscribers will not be notified of the state change, leading to stale caches, missed persistence writes, and inconsistent ACP extension state.

## Remediation
1. After restoring state, iterate through all restored keys and fire `_notifyChange()` for each.
2. Alternatively, add a bulk "restore" event type to `StateChangeEvent` and fire a single notification.
3. Consider firing events after the full restore completes (not during) to avoid partial-state observations.
