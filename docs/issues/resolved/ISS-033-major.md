# ISS-033 — TriggerDefinition.match Field Is Dead Code — Never Evaluated

**Severity**: Major
**File**: src/core/trigger-engine.ts:27 (type) / 165-227 (evaluate)
**KB Topic**: Extensibility — `_meta` field / Prompt Turn payload matching

## Original Issue
`TriggerDefinition.match` is a `Record<string, unknown>` for payload field matching, but `TriggerEngine.evaluate()` never checks it. Only the runtime `condition` function is evaluated.

## Verification

### Source Code Check
In `src/types/trigger.ts:27`, the `TriggerDefinition` type defines:
```typescript
/** Optional payload predicate — JSON-serializable field matcher */
match?: Record<string, unknown>;
```

In `src/core/trigger-engine.ts:165-227`, the `evaluate()` method checks:
1. `definition.maxFires` (line ~179)
2. `definition.sessionId` scope (lines ~183-187)
3. Event pattern via `matchesPattern()` (line ~191)
4. `definition.condition` function (line ~195)

The `definition.match` field is **never referenced** in `evaluate()`. A grep for `.match` in `trigger-engine.ts` returns zero results related to the `TriggerDefinition.match` field — only the `matchesPattern` helper function.

### ACP Spec Check
KB-08 describes extension metadata and declarative matchers. While `match` is not directly an ACP spec field, it is defined as a "payload predicate" in the project's own type system. Declaring a field as a payload matcher but never evaluating it means triggers configured with `match` criteria silently ignore those criteria — a correctness issue.

### Verdict: CONFIRMED
The `match` field exists in `TriggerDefinition` (line 27 of trigger.ts) but is completely ignored during `evaluate()`. Any trigger configured with `match` criteria will fire regardless of whether the payload matches.

## Remediation
1. Implement payload matching in `evaluate()` after the pattern check:
   ```typescript
   // Check declarative payload match
   if (definition.match) {
     const payload = event.payload as Record<string, unknown>;
     const matches = Object.entries(definition.match).every(
       ([key, value]) => payload?.[key] === value
     );
     if (!matches) continue;
   }
   ```
2. Add unit tests for `match`-based filtering.
3. Consider supporting nested matching and regex values for more expressive matchers.
