# ISS-150 — WRFCHandlers Uses Unsafe event.payload Casts Without Runtime Validation

**Severity**: Minor
**File**: src/extensions/wrfc/handlers.ts
**KB Topic**: Prompt Turn

## Original Issue
`event.payload as { ... }` — unsafe cast without runtime validation.

## Verification

### Source Code Check
Lines 75–100 of `src/extensions/wrfc/handlers.ts`:

```typescript
this._subscriptions = [
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
  this.eventBus.on('wrfc:review-complete', (event) =>
    this._onReviewComplete(
      event.payload as { workId: string; sessionId: string; score: number; passed: boolean },
    ),
  ),
  this.eventBus.on('wrfc:fix-complete', (event) =>
    this._onFixComplete(
      event.payload as { workId: string; sessionId: string; resolvedIssues: string[] },
    ),
  ),
```

Every event subscription casts `event.payload` to an unverified shape. The `EventBus` stores payloads as `unknown` (or a broad type), so these casts bypass TypeScript's type system. If a WRFC component emits an event with the wrong payload shape (e.g., missing `sessionId`), the handler will receive `undefined` for that field and may pass it downstream to ACP `sessionUpdate` calls without a runtime error.

### ACP Spec Check
The ACP KB (`04-prompt-turn.md`) defines `session/update` notifications that WRFC handlers ultimately produce (via `sessionUpdate` calls). If a handler receives a malformed payload due to the unsafe cast, it may emit an invalid `session/update` notification — for example, with a `null` or `undefined` `sessionId`. The ACP spec requires `sessionId` to be a valid non-empty string in all `session/update` notifications.

The connection between unsafe casts and potential ACP wire-format violations is real but indirect — the bug would only manifest if an upstream emitter sent a malformed payload. Nonetheless, the absence of runtime validation means there is no defensive boundary before ACP wire calls.

### Verdict: PARTIAL
The unsafe casts are confirmed at lines 77, 83, 89, and 95. The issue has merit — these casts are a code quality problem that removes a defensive validation boundary before ACP `sessionUpdate` calls. However, the issue is overstated as a direct ACP compliance violation: it is a TypeScript safety gap that *could* lead to invalid ACP messages if upstream emitters are incorrect, but does not currently produce invalid messages if the WRFC orchestrator emits correctly-shaped payloads.

## Remediation
1. Define typed event payload interfaces alongside the event emitters (in `src/extensions/wrfc/orchestrator.ts` or a shared types file).
2. Add runtime validation (Zod or manual guard) at event subscription boundaries:
   ```typescript
   this.eventBus.on('wrfc:state-changed', (event) => {
     const payload = event.payload as unknown;
     if (!isWRFCStateChangedPayload(payload)) {
       console.error('[WRFCHandlers] Malformed wrfc:state-changed payload', payload);
       return;
     }
     this._onStateChanged(payload);
   });
   ```
3. Alternatively, use a typed EventBus generic (`EventBus<EventMap>`) that enforces payload types at emit and subscribe sites — eliminating the need for runtime validation.
