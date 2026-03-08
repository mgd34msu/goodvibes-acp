# ISS-163 — `TriggerContext.event` type loses typed fields via double cast

**Severity**: Nitpick  
**File**: `src/core/trigger-engine.ts`  
**Lines**: 222  
**KB Reference**: KB-04 (Type Safety)

## Description

At line 223 of `trigger-engine.ts`, the event is cast via `event as unknown as Record<string, unknown>`, erasing any typed fields (`id`, `type`, `timestamp`, `_meta`) from the source event type. The `TriggerContext.event` type in `src/types/trigger.ts` is defined as `Record<string, unknown>`, which means downstream handlers lose all type information about known event fields.

### Verdict: CONFIRMED

The double cast is confirmed at line 223:
```typescript
event: event as unknown as Record<string, unknown>,
```

The `TriggerContext` type definition (`src/types/trigger.ts:45-52`) declares `event` as `Record<string, unknown>` with a comment acknowledging this limitation: "typed as generic record; L1 narrows to EventRecord". The double cast (`as unknown as`) is the TypeScript escape hatch that bypasses all type checking — it converts whatever typed event object exists into an untyped record, discarding field-level type safety.

This is a confirmed type safety issue. ACP events have well-defined fields (`type`, `timestamp`, etc.) per KB-04, and the double cast means neither the compiler nor handler code can rely on those fields being present. The L0 type should preserve at minimum the fields that the ACP protocol guarantees on all events.

## Remediation

1. Define a base event interface that includes known ACP event fields:
   ```typescript
   interface ACPEventBase {
     type: string;
     timestamp: number;
     _meta?: Record<string, unknown>;
     [key: string]: unknown;
   }
   ```
2. Update `TriggerContext.event` type from `Record<string, unknown>` to `ACPEventBase`.
3. Remove the double cast in `trigger-engine.ts:223` — with the widened type, a single assertion or generic constraint should suffice.
4. If the source event type is incompatible, fix the source type rather than casting through `unknown`.
