# ISS-056: Analytics response format doesn't match GoodVibesAnalyticsResponse spec

**Severity**: Major
**File**: src/plugins/analytics/engine.ts
**Line(s)**: 1-208 (whole file)
**Topic**: Extensibility

## Issue Description
Analytics response format doesn't match spec `GoodVibesAnalyticsResponse`. Engine returns a different shape.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/08-extensibility.md (lines 306-324)
- **Spec Says**: `GoodVibesAnalyticsResponse` should have shape: `{ tokenUsage: { input, output, total, budget?, remaining? }, turnCount, agentCount, duration_ms }`
- **Confirmed**: Yes
- **Notes**: The spec defines a flat analytics response with `tokenUsage` (nested), `turnCount`, `agentCount`, and `duration_ms`.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: The `_analytics()` method in `extensions.ts:246-299` returns `{ totalTokensUsed, activeBudgets, topTools, _meta }` — a completely different shape. No `tokenUsage` nested object, no `turnCount`, no `agentCount`, no `duration_ms`. The `AnalyticsEngine` class itself exposes methods like `getDashboard()`, `getSessionAnalytics()`, `getBudget()` but none return the spec-defined shape.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add a method to `AnalyticsEngine` that returns data in `GoodVibesAnalyticsResponse` format
2. Update `_analytics()` in `extensions.ts` to build the response matching the spec shape:
   ```typescript
   return {
     tokenUsage: { input: ..., output: ..., total: ..., budget: ..., remaining: ... },
     turnCount: ...,
     agentCount: ...,
     duration_ms: ...,
     _meta: META
   };
   ```
3. The current response fields (`activeBudgets`, `topTools`) could be kept as additional data inside `_meta` if desired
