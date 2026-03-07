# ISS-160 — Health Endpoint Response Lacks ACP Metadata

**Severity**: Minor
**File**: `src/extensions/lifecycle/daemon.ts:65-66`
**KB Topic**: Initialization

## Original Issue
Health endpoint response lacks ACP metadata (protocol version, capabilities, connected clients).

## Verification

### Source Code Check
Lines 65-66 of `src/extensions/lifecycle/daemon.ts`:
```typescript
if (url === '/health') {
  sendJson(res, 200, { status: 'ok', pid: process.pid, timestamp: Date.now() });
  return;
}
```

The `/health` endpoint returns a minimal JSON object with `status`, `pid`, and `timestamp`. It does not include protocol version, capabilities, or connected client counts.

The `/ready` endpoint similarly returns:
```typescript
sendJson(res, 200, { status: 'ready', pid: process.pid, timestamp: Date.now() });
```

### ACP Spec Check
The ACP spec (`02-initialization.md` KB) defines the `initialize` handshake over the JSON-RPC transport channel — it does not define a `/health` HTTP endpoint at all. Health check endpoints are an operational/infrastructure concern, not part of the ACP protocol specification. The ACP spec has no requirements for what fields a health endpoint must return.

The `initialize` response (over JSON-RPC) is the ACP mechanism for advertising protocol version and capabilities:
```json
{
  "protocolVersion": "2025-01",
  "agentCapabilities": { ... },
  "authMethods": []
}
```

This is unrelated to an HTTP `/health` endpoint used for infrastructure monitoring.

### Verdict: NOT_ACP_ISSUE
The issue is real as an operational concern — a richer health response could include protocol version and active session count for monitoring purposes. However, the `/health` endpoint is not defined by the ACP specification; it is an internal operational endpoint. ACP has no requirements for its content. The ACP-required protocol version and capabilities are correctly expressed via the `initialize` handshake, not via `/health`.

## Remediation
N/A for ACP compliance. As an operational improvement, consider enriching the health response:
```typescript
sendJson(res, 200, {
  status: 'ok',
  pid: process.pid,
  timestamp: Date.now(),
  // Optional operational metadata (not ACP-required)
  protocolVersion: '2025-01',
  activeSessions: sessionManager.count(),
});
```
