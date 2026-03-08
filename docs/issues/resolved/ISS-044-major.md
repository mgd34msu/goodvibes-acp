# ISS-044 — `GoodVibesAnalyticsRequest`/`Response` Wire-Format Types Not Defined

**Severity**: Major
**File**: src/plugins/analytics/types.ts:1-156
**KB Topic**: Extension Methods — `_goodvibes/analytics` Wire Format (08-extensibility.md lines 306-324)

## Original Issue
The types file defines only internal analytics types. The ACP wire-format types `GoodVibesAnalyticsRequest` and `GoodVibesAnalyticsResponse` are not defined anywhere.

## Verification

### Source Code Check
The symbols exported from `src/plugins/analytics/types.ts` are:
- `TokenBudget`
- `TokenUsageEntry`
- `SessionAnalytics`
- `AnalyticsExportFormat`
- `DashboardData`
- `BudgetParams`
- `QueryParams`
- `ExportParams`
- `SyncParams`
- `DashboardParams`
- `TagParams`
- `ConfigParams`
- `AnalyticsStore`

No `GoodVibesAnalyticsRequest` or `GoodVibesAnalyticsResponse` types exist.

### ACP Spec Check
KB-08 (lines 306-324) defines two wire-format interfaces that constitute the ACP contract:
```typescript
interface GoodVibesAnalyticsRequest {
  sessionId: string;
  scope: 'session' | 'workflow' | 'agent';
  id?: string;
}

interface GoodVibesAnalyticsResponse {
  tokenUsage: { input: number; output: number; total: number; budget?: number; remaining?: number; };
  turnCount: number;
  agentCount: number;
  duration_ms: number;
}
```
These interfaces define the contract between client and agent for the `_goodvibes/analytics` extension method.

### Verdict: CONFIRMED
The ACP-mandated wire-format types are absent from the codebase. While `getAnalyticsResponse()` returns a structurally similar object to `GoodVibesAnalyticsResponse`, the types are not formally defined, preventing type-safe ACP message handling and breaking the contract-first design principle.

## Remediation
1. Add `GoodVibesAnalyticsRequest` and `GoodVibesAnalyticsResponse` interfaces to `src/plugins/analytics/types.ts` (or a dedicated ACP wire-format types file).
2. Type the `getAnalyticsResponse()` return as `GoodVibesAnalyticsResponse`.
3. Type the handler's input parameter as `GoodVibesAnalyticsRequest`.
4. Consider placing wire-format types in L0 (`src/types/`) since they define ACP protocol contracts.
