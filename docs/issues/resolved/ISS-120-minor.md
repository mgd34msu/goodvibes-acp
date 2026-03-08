# ISS-120 — Missing `_meta` budget format alignment — `totalBudget` vs spec `maxTokens`

**Severity**: Minor
**File**: `src/plugins/analytics/types.ts`
**KB Topic**: KB-08: Budget Wire Format

## Original Issue
KB-08 shows `_meta` budget as `{ maxTokens, maxTurns }`. The `TokenBudget` type uses `totalBudget` (not `maxTokens`) and has no `maxTurns`. No mapping layer exists.

## Verification

### Source Code Check
The `TokenBudget` type (types.ts lines 13-26):
```typescript
export type TokenBudget = {
  sessionId: string;
  totalBudget: number;
  used: number;
  remaining: number;
  warningThreshold: number;
  alertThreshold: number;
};
```

KB-08 (line 238) defines the `_meta` budget wire format:
```json
"_goodvibes/budget": { "maxTokens": 100000, "maxTurns": 20 }
```

Differences:
- KB-08 uses `maxTokens`; code uses `totalBudget` — naming mismatch
- KB-08 includes `maxTurns`; code has no turn-limit concept at all
- No conversion/mapping layer exists between the internal `TokenBudget` type and the `_meta` wire format

The `GoodVibesAnalyticsResponse` type (types.ts lines 167-178) uses `budget` and `remaining` in `tokenUsage`, which partially aligns with the analytics response format but not with the `_meta` budget format.

### ACP Spec Check
KB-08 explicitly shows the `_goodvibes/budget` `_meta` shape with `maxTokens` and `maxTurns`. The internal type uses different naming (`totalBudget` vs `maxTokens`) and is missing `maxTurns` entirely. Since `_meta` is the extension point for custom data, the naming should match what KB-08 defines for interoperability.

### Verdict: CONFIRMED
The `TokenBudget` type does not align with KB-08's `_meta` budget wire format. The naming mismatch (`totalBudget` vs `maxTokens`) and missing `maxTurns` field are confirmed. No conversion layer bridges internal types to the defined wire format.

## Remediation
1. Add a `toBudgetMeta(budget: TokenBudget): { maxTokens: number; maxTurns?: number }` conversion function.
2. Add `maxTurns` tracking to `TokenBudget` or a separate turn counter.
3. Use the conversion function when attaching budget data to `_meta` fields in outgoing ACP messages.
4. Consider renaming `totalBudget` to `maxTokens` internally for consistency, or keep the internal name and rely on the conversion layer.
