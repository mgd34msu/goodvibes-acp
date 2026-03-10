# ISS-032: `_analytics()` returns wrong wire format

**Severity**: Major
**Category**: KB-08 Extensibility
**File**: `src/extensions/acp/extensions.ts`
**Lines**: 259-308

## Description

The `_analytics()` handler in the extensions module returns `{ totalTokensUsed, activeBudgets, topTools }` — a non-standard shape. The analytics engine's `getAnalyticsResponse()` method already produces the correct `GoodVibesAnalyticsResponse` shape with `{ tokenUsage, turnCount, agentCount, duration_ms }`, but it is not called by the extension handler.

### Verdict: CONFIRMED

Source code shows `_analytics()` manually queries `analyticsEngine.getDashboard()` and constructs its own response shape with `totalTokensUsed`, `activeBudgets`, `topTools` fields. Meanwhile, `getAnalyticsResponse()` in the analytics engine returns the KB-08 compliant shape with `tokenUsage`, `turnCount`, `agentCount`, `duration_ms`.

## Remediation

1. Replace the manual dashboard query in `_analytics()` with a call to `analyticsEngine.getAnalyticsResponse(params)`.
2. Update the registry lookup type to expose `getAnalyticsResponse()`.
3. Preserve `_meta` propagation from the current implementation.

## ACP Reference

KB-08: `_goodvibes/analytics` defines a specific wire format that must be adhered to.
