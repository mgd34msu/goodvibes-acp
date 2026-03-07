# ISS-126 — AnalyticsEngine Has No _meta Field Support for Trace Context

**Severity**: Minor
**File**: `src/plugins/analytics/engine.ts`
**KB Topic**: Extensibility

## Original Issue
No `_meta` field support for trace context propagation. *(Extensibility)*

## Verification

### Source Code Check
`AnalyticsEngine` (lines 26-60+):
```typescript
export class AnalyticsEngine {
  private readonly _store: AnalyticsStore;
  private readonly _budget: BudgetTracker;
  // ... no _meta handling

  ensureSession(sessionId: string): SessionAnalytics { ... }
  // ... all methods deal with token usage, budgets, exports
}
```

None of `AnalyticsEngine`'s public methods accept or propagate a `_meta` parameter. The `track()` method (which records token usage) has no mechanism to attach or forward trace context. When analytics data is served via the `_goodvibes/analytics` extension method, it cannot include `traceparent` or other `_meta` from the original request context.

### ACP Spec Check
KB-08 defines the `GoodVibesAnalyticsResponse` format:
```typescript
interface GoodVibesAnalyticsResponse {
  tokenUsage: { input: number; output: number; total: number; budget?: number; remaining?: number; };
  turnCount: number;
  agentCount: number;
  duration_ms: number;
}
```

This response type does not require `_meta`. However, KB-08 states `_meta` is available on all response results and is used for trace context. If a client sends `_goodvibes/analytics` with `_meta.traceparent`, the `GoodVibesExtensions.handle()` method (which calls `AnalyticsEngine`) does not propagate that trace context through to the analytics calls or back to the response.

### Verdict: CONFIRMED
The issue is confirmed in that `AnalyticsEngine` has no trace context threading. This is a valid extensibility gap per the GoodVibes KB-08 design. However, the impact is limited — analytics queries are typically fire-and-forget; distributed tracing through analytics is a nice-to-have. The issue is accurately described but low-impact.

## Remediation
1. Add optional `_meta` parameter to the `_goodvibes/analytics` handler in `GoodVibesExtensions._analytics()`:
   ```typescript
   private _analytics(params?: unknown): unknown {
     const meta = (params as { _meta?: Record<string, unknown> })?._meta;
     const result = { /* existing analytics data */ };
     return { ...result, _meta: { ...META, ...meta } };
   }
   ```
2. If trace propagation is needed at the `AnalyticsEngine` level, add an optional `traceContext?: Record<string, unknown>` parameter to `track()` and store it with each `TokenUsageEntry`.
