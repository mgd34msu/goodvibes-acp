# ISS-119 — Analytics `_goodvibes/analytics` endpoint unreachable via ACP

**Severity**: Minor
**File**: `src/plugins/analytics/engine.ts`
**KB Topic**: KB-08: Extension Method Dispatch

## Original Issue
`getAnalyticsResponse()` exists but nothing wires it to the ACP extension method dispatch. The endpoint is unreachable.

## Verification

### Source Code Check
The ACP dispatch path DOES exist:
1. `GoodVibesAgent.extMethod()` (agent.ts lines 535-557) routes all `_goodvibes/*` calls to `GoodVibesExtensions.handle()`.
2. `GoodVibesExtensions.handle()` (extensions.ts lines 63-76) has a `case '_goodvibes/analytics'` that calls `this._analytics(params)`.
3. `_analytics()` (extensions.ts lines 254-310) tries to get analytics from the registry.

However, there is a **registry key mismatch**:
- The analytics plugin registers as `'analytics'` (plugins/analytics/index.ts line 45: `reg.register('analytics', new AnalyticsEngine())`)
- The extensions handler looks up `'analytics-engine'` (extensions.ts line 266: `this._registry.getOptional<...>('analytics-engine')`)

Because the keys don't match, `getOptional('analytics-engine')` returns `undefined`, and the handler returns zero values:
```typescript
return { totalTokensUsed: 0, activeBudgets: [], topTools: [] };
```

The dispatch path works — the endpoint IS reachable — but it always returns empty data due to the registry key mismatch.

Additionally, `_analytics()` in extensions.ts uses a different response format than `getAnalyticsResponse()` in engine.ts. The extension handler builds its own response shape rather than delegating to the engine's `getAnalyticsResponse()` method.

### ACP Spec Check
KB-08 (lines 303-324) defines the `_goodvibes/analytics` wire format with `tokenUsage`, `turnCount`, `agentCount`, and `duration_ms`. The extensions handler returns `{ totalTokensUsed, activeBudgets, topTools }` which does not match the KB-08 wire format.

### Verdict: PARTIAL
The issue's claim that the endpoint is "unreachable" is incorrect — the ACP dispatch path exists and works. However, the endpoint effectively returns empty/zero data due to a registry key mismatch (`'analytics'` vs `'analytics-engine'`). Additionally, the response format does not match KB-08's defined wire format.

## Remediation
1. Fix the registry key: change either the plugin registration to `'analytics-engine'` or the extension lookup to `'analytics'`.
2. Update `_analytics()` to use the engine's `getAnalyticsResponse()` method to ensure the response matches the KB-08 wire format.
3. Alternatively, align the extensions handler's response shape with the `GoodVibesAnalyticsResponse` type from `types.ts`.
