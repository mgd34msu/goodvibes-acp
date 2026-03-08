# ISS-084 — EventBus prefix wildcard only matches last colon segment

**Severity**: Minor
**File**: `src/core/event-bus.ts`
**Lines**: 217–223
**KB Reference**: KB-08 (Extensibility)

## Issue

The EventBus uses `lastIndexOf(':')` for prefix wildcard matching:

```typescript
const colonIdx = type.lastIndexOf(':');
if (colonIdx !== -1) {
  const prefix = type.slice(0, colonIdx + 1);
  if (this._prefixHandlers.has(prefix)) {
    sets.push(this._prefixHandlers.get(prefix)!);
  }
}
```

This means subscribing to `a:*` will match `a:b` but **not** `a:b:c` (because `lastIndexOf(':')` for `a:b:c` yields `a:b:` not `a:`). Multi-level event hierarchies require subscribing to each prefix level individually.

### Verdict: NOT_ACP_ISSUE

The EventBus is an internal L1 core infrastructure component. The ACP protocol (KB-08) defines extensibility via `_meta` fields and `_`-prefixed methods, not via event bus wildcard semantics. This is a runtime design choice with no ACP compliance implications.

The behavior is consistent and predictable — it matches the immediate parent prefix only. If multi-level wildcards are desired, this is a feature request, not a compliance issue.
