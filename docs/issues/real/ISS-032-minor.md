# ISS-032 — Fragile SDK type cast for finish event during shutdown

**Severity**: Minor
**File**: `src/main.ts`
**KB Topic**: KB-10: Prompt Handling

## Original Issue
The shutdown handler casts `{ sessionUpdate: 'finish', stopReason: 'cancelled' }` through `unknown` to `acp.SessionUpdate`. This double-cast silences all type checking and will not produce a compile error if the wire format changes.

## Verification

### Source Code Check
Line 131 of `main.ts`:
```typescript
const finishUpdate = { sessionUpdate: 'finish', stopReason: 'cancelled' } as unknown as acp.SessionUpdate;
```
This is a classic double-cast (`as unknown as T`) that bypasses TypeScript's type narrowing entirely. If the SDK's `SessionUpdate` type changes its discriminator field or stop reason values, this code will silently produce incorrect wire data.

### ACP Spec Check
KB-10 (Implementation Guide) documents the shutdown pattern under "Cancelled errors" (line 167): agents should catch AbortError and return `stopReason: 'cancelled'`. The double-cast is an implementation shortcut that works today but is fragile against SDK evolution.

### Verdict: CONFIRMED
The double-cast through `unknown` is present and does silence all compile-time type checking. While it produces correct output today, it is a maintenance hazard.

## Remediation
1. Create a typed helper function (e.g., `createFinishUpdate()` in `src/extensions/acp/compat.ts`) that constructs the finish update using the SDK's type system.
2. If the SDK type does not directly support constructing this object, document the gap in the helper and use a single well-commented cast in one place.
3. Add a unit test that verifies the shape of the finish update against the SDK type.
