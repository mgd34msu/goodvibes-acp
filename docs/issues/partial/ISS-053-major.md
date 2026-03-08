# ISS-053 — HTTP webhook responses use plain text instead of JSON-RPC 2.0 envelope

**Severity**: Major
**File**: `src/extensions/external/http-listener.ts`
**KB Topic**: KB-08/KB-10: JSON-RPC 2.0

## Original Issue
The `reply()` helper sends plain-text HTTP responses. Per ACP spec, all inter-process communication within the ACP layer must use JSON-RPC 2.0 envelopes.

## Verification

### Source Code Check
At lines 119-129, the `reply()` function sends plain-text responses:
```typescript
function reply(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}
```
Used at line 303: `reply(res, 200, 'OK');`

The file header (lines 15-24) contains a TODO(ISS-018) acknowledging this exact issue and describing the needed JSON-RPC 2.0 envelope format.

### ACP Spec Check
KB-08 shows that all ACP extension methods use JSON-RPC 2.0 envelopes. KB-10 discusses error handling via JSON-RPC responses. However, the ACP spec defines JSON-RPC 2.0 for *client-agent communication*, not for external webhook receivers. The HTTP listener receives webhooks from external services (GitHub, etc.) and emits events onto the internal EventBus — it is not part of the ACP client-agent transport.

### Verdict: PARTIAL
The code does use plain-text HTTP responses, and the developers have already identified this as an issue (TODO ISS-018). However, the claim that "all inter-process communication within the ACP layer must use JSON-RPC 2.0" overstates the spec requirement. The webhook listener is an external integration point, not an ACP client-agent transport channel. The JSON-RPC 2.0 requirement applies to ACP protocol messages, not to HTTP webhook acknowledgment responses to external services.

## Remediation
1. If the webhook listener is intended to participate in ACP inter-process communication (not just receive external events), wrap responses in JSON-RPC 2.0 envelopes as described in the existing TODO.
2. If it remains an external-facing webhook receiver, the plain-text `200 OK` response is appropriate for webhook acknowledgment, but the internal event routing should use ACP-compliant structures.
