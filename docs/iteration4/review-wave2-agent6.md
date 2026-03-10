# ACP Compliance Review: Analytics & Budget Tracking

**Reviewer**: Wave 2, Agent 6
**Files reviewed**:
- `src/plugins/analytics/types.ts`
- `src/plugins/analytics/engine.ts`
- `src/plugins/analytics/index.ts`
- `src/plugins/analytics/dashboard.ts`
- `src/plugins/analytics/sync.ts`
- `src/plugins/analytics/budget.ts`
- `src/plugins/analytics/export.ts`
- `src/extensions/acp/extensions.ts` (analytics handler)

**KB references**: `08-extensibility.md`, `04-prompt-turn.md`, `03-sessions.md`

---

## Issues

### 1. `_analytics()` returns wrong wire format (Severity: HIGH)
**File**: `src/extensions/acp/extensions.ts:259-308`
**KB**: `08-extensibility.md` lines 306-324

The `_analytics()` handler returns `{ totalTokensUsed, activeBudgets, topTools }` — a custom shape. The KB spec defines `GoodVibesAnalyticsResponse` as `{ tokenUsage: { input, output, total, budget?, remaining? }, turnCount, agentCount, duration_ms }`. The engine already has `getAnalyticsResponse()` that produces the correct shape, but `_analytics()` does not use it.

### 2. `scope` and `id` fields from request are ignored (Severity: HIGH)
**File**: `src/plugins/analytics/engine.ts:266-268`
**KB**: `08-extensibility.md` lines 308-310

`GoodVibesAnalyticsRequest` defines `scope: 'session' | 'workflow' | 'agent'` and optional `id` for filtering. `getAnalyticsResponse()` only branches on the presence of `sessionId`, completely ignoring `scope` and `id`. Workflow and agent scopes silently fall through to session-level data without even a documented fallback warning.

### 3. `_pendingWarnings` is write-only (Severity: MEDIUM)
**File**: `src/plugins/analytics/engine.ts:48, 128-150`
**KB**: N/A (internal quality)

The `_pendingWarnings` map is populated when thresholds are crossed but never consumed, read, or cleared by any public API. The `getWarnings()` method delegates to `BudgetTracker.getWarnings()` which recalculates from current state — it does not read `_pendingWarnings`. This is dead code that creates false expectations.

### 4. `agentCount` hardcoded to 1 for per-session queries (Severity: MEDIUM)
**File**: `src/plugins/analytics/engine.ts:289`
**KB**: `08-extensibility.md` line 322

Per-session analytics always returns `agentCount: 1`. The KB defines `agentCount` as the number of agents in the queried scope. Even if per-agent tracking isn't implemented yet, hardcoding 1 is misleading — it should at minimum be 0 (unknown) or derive from available data.

### 5. `_analytics()` accesses `_store` directly, breaking encapsulation (Severity: MEDIUM)
**File**: `src/extensions/acp/extensions.ts:268-269, 292-299`
**KB**: N/A (architectural quality)

The extension handler reaches into `analyticsEngine._store.budgets` (a private field) to build `activeBudgets`. The engine exposes `getBudget(sessionId)` and `getAnalyticsResponse()` as public API. Direct `_store` access couples the extension layer to internal implementation details and will break if the engine refactors its storage.

### 6. Registry key vs. capability mismatch (Severity: MEDIUM)
**File**: `src/plugins/analytics/index.ts:44,49`
**KB**: N/A (internal consistency)

The manifest declares capabilities `['analytics', 'budget']` and the JSDoc says it registers under the `'analytics'` key, but `register()` actually uses `'analytics-engine'` as the registry key. Consumers in `extensions.ts:271` use `'analytics-engine'` to look it up, so it works, but the manifest/doc mismatch could confuse developers and break capability-based lookups.

### 7. `turnCount` conflates tool calls with prompt turns (Severity: MEDIUM)
**File**: `src/plugins/analytics/engine.ts:288, 303`
**KB**: `04-prompt-turn.md` lines 1-3

The KB defines a "turn" as a complete `session/prompt` → response cycle (which may include multiple tool calls). `getAnalyticsResponse()` returns `turnCount: session.entries.length` where each entry is a single `TokenUsageEntry` (one tool call). This overstates the turn count by a factor equal to the average tools-per-turn.

### 8. `TokenBudget.totalBudget` vs. KB wire format `budget` (Severity: LOW)
**File**: `src/plugins/analytics/types.ts:17` vs. `engine.ts:286`
**KB**: `08-extensibility.md` line 317

The internal type uses `totalBudget` while the KB wire format uses `budget`. The `getAnalyticsResponse()` method correctly maps `budget.totalBudget` to the response field `budget` (line 286), so the wire format is correct. However, the naming divergence between internal and external types adds cognitive load. Minor concern.

### 9. No `_meta` propagation in analytics response (Severity: LOW)
**File**: `src/plugins/analytics/engine.ts:266-319`
**KB**: `08-extensibility.md` lines 16-26

KB-08 states that `_meta` is available on response results for custom data. The `_analytics()` handler in `extensions.ts` includes `_meta` in its (wrongly-shaped) response, but `getAnalyticsResponse()` in the engine does not support `_meta` passthrough. If the handler is fixed to use `getAnalyticsResponse()`, `_meta` support would be lost unless the engine adds it.

### 10. Shutdown error swallowed silently (Severity: LOW)
**File**: `src/plugins/analytics/engine.ts:326-328`
**KB**: N/A (robustness)

`shutdown()` calls `this._sync.syncAll()` which writes to the filesystem. If any write fails (permissions, disk full), the error propagates as an unhandled rejection from the plugin shutdown. There's no try/catch or logging. In `index.ts:52`, `shutdown` calls `_engine?.shutdown()` without error handling either.

---

## Summary

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | Wrong wire format in `_analytics()` | HIGH | extensions.ts |
| 2 | `scope`/`id` fields ignored | HIGH | engine.ts |
| 3 | `_pendingWarnings` write-only dead code | MEDIUM | engine.ts |
| 4 | `agentCount` hardcoded to 1 | MEDIUM | engine.ts |
| 5 | `_store` accessed directly | MEDIUM | extensions.ts |
| 6 | Registry key vs. capability mismatch | MEDIUM | index.ts |
| 7 | `turnCount` conflates tool calls with turns | MEDIUM | engine.ts |
| 8 | `totalBudget` vs `budget` naming divergence | LOW | types.ts |
| 9 | No `_meta` propagation | LOW | engine.ts |
| 10 | Shutdown errors unhandled | LOW | engine.ts |

## Overall Score: 5/10

The analytics plugin has solid internal design — clean separation of concerns (budget, dashboard, export, sync), proper type definitions, and functional persistence. However, ACP compliance is weak: the extension handler returns a non-spec response format (issue 1), the spec-defined `scope`/`id` request fields are completely ignored (issue 2), and the handler bypasses the engine's own ACP-compliant method in favor of direct store access (issue 5). The `turnCount` semantics are also incorrect per KB-04 (issue 7). Fixing issues 1, 2, 5, and 7 would bring this to a 7-8 range.
