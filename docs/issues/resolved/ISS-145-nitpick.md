# ISS-145 — `handlerCount` property assumption on EventBus

**Severity**: nitpick
**File**: `src/extensions/ipc/router.ts`
**Line**: 116
**KB Reference**: KB-00 (Correctness)

## Issue Description

The `status` handler accesses `this._eventBus.handlerCount` directly. The issue claims this could fail at runtime if EventBus renames the property.

## Source Evidence

- `src/extensions/ipc/router.ts` line 116: `handlerCount: this._eventBus.handlerCount,`
- `src/core/event-bus.ts` line 295: `get handlerCount(): number {` — the getter exists on the concrete class

### Verdict: PARTIAL

The `handlerCount` getter exists on the `EventBus` class, so it does not fail at runtime today. However, the concern about coupling to a concrete class property (rather than an interface contract) is valid as a code quality observation. If `_eventBus` were typed as an interface, `handlerCount` would need to be part of that interface.

## Remediation

1. If `_eventBus` is typed as the concrete `EventBus` class, TypeScript already catches renames at compile time — no runtime risk
2. If an `IEventBus` interface exists, ensure `handlerCount` is part of it
3. Optionally use optional chaining for defensive access: `this._eventBus?.handlerCount ?? 0`
