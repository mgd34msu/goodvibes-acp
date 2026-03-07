# ISS-138 — Event Handlers Use Untyped Payload Casting

**Severity**: Minor
**File**: src/extensions/wrfc/handlers.ts
**KB Topic**: Implementation Guide

## Original Issue
Event handlers use untyped payload casting (`event.payload as { ... }`). Define typed event maps or use Zod schemas at subscription boundaries.

## Verification

### Source Code Check
In `src/extensions/wrfc/handlers.ts`, the `register()` method (lines 72-112) contains multiple instances of unsafe payload casting:
```typescript
this.eventBus.on('wrfc:state-changed', (event) =>
  this._onStateChanged(
    event.payload as { workId: string; sessionId: string; from: WRFCState; to: WRFCState; attempt: number },
  ),
),
this.eventBus.on('wrfc:work-complete', (event) =>
  this._onWorkComplete(
    event.payload as { workId: string; sessionId: string; filesModified: string[] },
  ),
),
// ... and 4 more similar casts
```
All six event subscriptions cast `event.payload` with `as { ... }` without any runtime validation. If the event emitter sends a differently-shaped payload (e.g., due to a refactor), the cast succeeds silently but handlers receive wrong data.

### ACP Spec Check
The ACP spec does not mandate internal event bus typing patterns. This is a TypeScript type-safety and maintainability issue for the internal event system, not an ACP protocol compliance concern.

### Verdict: NOT_ACP_ISSUE
The issue is real and correctly described — all six WRFC event subscriptions use unsafe `as` casts with inline type annotations. This is a code quality issue. However, it has no bearing on ACP protocol compliance; the event bus is entirely internal.

## Remediation
Define a typed event map for the EventBus:
```typescript
// In types/events.ts or wrfc/types.ts:
export interface WRFCEventMap {
  'wrfc:state-changed': { workId: string; sessionId: string; from: WRFCState; to: WRFCState; attempt: number };
  'wrfc:work-complete': { workId: string; sessionId: string; filesModified: string[] };
  'wrfc:review-complete': { workId: string; sessionId: string; score: number; passed: boolean };
  'wrfc:fix-complete': { workId: string; sessionId: string; resolvedIssues: string[] };
  'wrfc:chain-complete': { workId: string; sessionId: string; finalState: WRFCState; score?: number };
  'wrfc:cancelled': { workId: string; sessionId: string };
}
```
Then use Zod schemas at subscription boundary, or parameterize `EventBus.on<T>()` with the payload type so the cast is at least narrowed to the declared map type rather than arbitrary inline shapes.
