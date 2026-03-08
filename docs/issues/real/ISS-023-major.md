# ISS-023 — Health endpoint not integrated with HealthCheck module

**Severity**: Major
**File**: `src/extensions/lifecycle/daemon.ts`
**Lines**: 66-73
**KB Reference**: KB-10 (Implementation)

## Description

The `/health` HTTP endpoint in `DaemonManager` returns a static response:

```typescript
sendJson(res, 200, {
  status: 'ok',
  pid: process.pid,
  timestamp: Date.now(),
  agent: { name: 'goodvibes', version: RUNTIME_VERSION, protocolVersion: 1 },
});
```

It never queries the `HealthCheck` module (which exists at `src/extensions/lifecycle/health.ts` and is used elsewhere in the codebase via `healthCheck.check()`). A runtime with failing sub-checks (e.g., disconnected MCP servers, memory pressure) still reports `status: 'ok'`.

### Verdict: CONFIRMED

The `/health` endpoint returns hardcoded `{ status: 'ok' }` at line 67-72. The `HealthCheck` class exists and is instantiated in `main.ts` (line 87) but is never passed to `DaemonManager`. The `extensions.ts` module correctly uses `healthCheck.check()` for ACP status, but the HTTP health endpoint does not.

## Remediation

1. Add `healthCheck: HealthCheck` to `DaemonOptions` or `DaemonManager` constructor
2. In `handleHealthRequest`, call `healthCheck.check()` and return its result
3. Map HealthCheck status to appropriate HTTP status codes (200 for healthy, 503 for degraded/unhealthy)
4. Include sub-check details in the response body for observability
