# ISS-033: Analytics `scope` and `id` fields from request are ignored

**Severity**: Major
**Category**: KB-08 Extensibility
**File**: `src/plugins/analytics/engine.ts`
**Lines**: 266-268

## Description

`GoodVibesAnalyticsRequest` defines `scope: 'session' | 'workflow' | 'agent'` and optional `id`. The `getAnalyticsResponse()` method accepts the request type but only branches on `sessionId` presence, never reading `request.scope` or `request.id`.

### Verdict: PARTIAL

The method signature accepts `GoodVibesAnalyticsRequest` which includes `scope` and `id` fields, and the docstring acknowledges workflow and agent scopes. However, the implementation never accesses `request.scope` — it only checks `sessionId`. The comment explicitly states "Workflow and agent scopes currently fall back to session-level data since per-workflow/agent tracking is not yet implemented." This is a known gap, not an oversight, but still produces incorrect results for non-session scopes.

## Remediation

1. At minimum, read `request.scope` and `request.id` and filter accordingly.
2. For `scope: 'workflow'` and `scope: 'agent'`, return appropriate data or a clear unsupported error.
3. When `scope` is `'session'`, use `request.id ?? request.sessionId` as the session identifier.

## ACP Reference

KB-08: `_goodvibes/analytics` request shape includes `scope` and `id` for scoped queries.
