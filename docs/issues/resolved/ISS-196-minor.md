# ISS-196 — Health Endpoint Response Lacks ACP Metadata

**Severity**: Minor
**File**: src/extensions/lifecycle/daemon.ts:65-66
**KB Topic**: Initialization

## Original Issue

**[src/extensions/lifecycle/daemon.ts:65-66]** Health endpoint response lacks ACP metadata. (Also noted as minor #160.) *(Initialization)*

## Verification

### Source Code Check

Lines 65-66 of `src/extensions/lifecycle/daemon.ts`:
```typescript
if (url === '/health') {
  sendJson(res, 200, { status: 'ok', pid: process.pid, timestamp: Date.now() });
  return;
}
```

The health endpoint returns `{ status: 'ok', pid, timestamp }`. There is no ACP agent name, version, protocol version, or capability information in the response. This is confirmed.

### ACP Spec Check

The ACP Initialization KB defines the `initialize` JSON-RPC request/response exchange:
- Client sends `initialize` with `protocolVersion` and `clientCapabilities`
- Agent responds with `protocolVersion`, `agentCapabilities`, optional `agentInfo`, and `authMethods`

The `agentInfo` field contains `name`, `title`, and `version`. The spec explicitly states the agent SHOULD provide `agentInfo` to help clients log/debug which agent is connected.

However, the ACP spec defines this for the **JSON-RPC `initialize` method**, not for HTTP health endpoints. The daemon's `/health` endpoint is a separate internal HTTP monitoring endpoint (used by process supervisors and health checks), not part of the ACP JSON-RPC protocol. The ACP spec makes no requirements about HTTP health endpoints — it does not define `/health`, `/ready`, or any such endpoint at all.

The claim that the health endpoint "lacks ACP metadata" conflates two separate concerns: the ACP protocol initialization handshake (JSON-RPC) and internal HTTP process health monitoring. These are different interfaces serving different consumers.

### Verdict: PARTIAL

The underlying concern has merit: the `/health` endpoint could usefully include agent name and version for debugging purposes. However, the issue is overstated by attributing this to ACP compliance — the ACP spec has no requirements about HTTP health endpoints. The fix is a good practice (include `agentInfo` in health response) but is not required for ACP protocol compliance.

## Remediation

For better observability (not ACP compliance), add agent metadata to the health response:

```typescript
if (url === '/health') {
  sendJson(res, 200, {
    status: 'ok',
    pid: process.pid,
    timestamp: Date.now(),
    agent: {
      name: 'goodvibes',
      version: '0.1.0',          // pull from package.json or config
      protocolVersion: 1,         // ACP protocol version supported
    },
  });
  return;
}
```

This is useful for operational tooling but is not required for ACP compliance.
