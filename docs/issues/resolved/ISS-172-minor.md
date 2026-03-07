# ISS-172 — Unsafe `event.payload` Cast in WRFC Handlers

**Severity**: Minor (also noted as nitpick)
**File**: src/extensions/wrfc/handlers.ts:77
**KB Topic**: Prompt Turn

## Original Issue
`event.payload as { ... }` — unsafe cast. (Also noted as minor #150; this entry notes the nitpick-level incidence in a separate location.)

## Verification

### Source Code Check
Lines 74-95 show three `event.payload as { ... }` casts:
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
this.eventBus.on('wrfc:review-complete', (event) =>
  this._onReviewComplete(
    event.payload as { workId: string; sessionId: string; score: number; passed: boolean },
  ),
),
```

These are TypeScript `as` casts — they suppress type-checking but do not validate at runtime. If the event bus emits a payload with wrong shape, the cast silently passes and downstream code will fail with unhelpful errors.

### ACP Spec Check
This is a TypeScript type-safety issue internal to the event bus implementation. The ACP specification says nothing about how internal event payloads are typed. This has no relationship to ACP wire format, protocol compliance, or session handling.

### Verdict: NOT_ACP_ISSUE
The issue is real — the unsafe casts reduce type safety and make debugging harder. However, it is purely a TypeScript implementation quality concern. It has no relationship to ACP protocol compliance. The ACP spec does not govern internal event bus payload typing.

## Remediation
N/A for ACP compliance. For code quality:
- Define typed event maps in the event bus (e.g., `EventMap` interface keyed by event name)
- Replace casts with proper type inference from the event map
- Or add runtime validation with Zod/type guards before the cast
