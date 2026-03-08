# ISS-013 — initialize rejects clients with lower protocol versions

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**KB Topic**: KB-01: Protocol Version Negotiation

## Original Issue
The `initialize` method rejects clients with a protocol version lower than the agent's supported version by throwing an error. The ACP spec's initialize flow does not prescribe rejecting lower versions outright. The agent should respond with its own supported version and let the client decide whether to proceed.

## Verification

### Source Code Check
At lines ~197-202 of `src/extensions/acp/agent.ts`:
```typescript
if (clientVersion < SUPPORTED_VERSION) {
  throw Object.assign(
    new Error(`Unsupported protocol version: ${clientVersion}. Minimum supported: ${SUPPORTED_VERSION}`),
    { code: -32600 },
  );
}
const negotiatedVersion = Math.min(clientVersion, SUPPORTED_VERSION) as schema.ProtocolVersion;
```

### ACP Spec Check
KB-02 (Initialization) states:
- "Client sends HIGHEST version it supports; agent will negotiate down"
- "Agent MUST respond with version <= client's version"
- "If agent can't support any client version -> error"
- The response type says `protocolVersion` "MUST be <= client's requested version"

The spec explicitly allows error when the agent cannot support the client's version. If the client sends version 0 and the agent requires version 1, the agent genuinely cannot support it. The guard is consistent with "If agent can't support any client version -> error."

### Verdict: PARTIAL
The version guard is defensible under the spec's "If agent can't support any client version -> error" clause. However, the issue has some merit: the spec's negotiation model implies the agent responds with its own version and lets the client decide. In practice, since protocol version is currently just `1`, rejecting version 0 is reasonable. The remediation suggestion to remove the guard entirely is incorrect — the `Math.min` alone would produce version 0, which the agent doesn't support. A better approach would be to respond with the agent's version and let the client handle the mismatch.

## Remediation
Consider changing the error to return `protocolVersion: SUPPORTED_VERSION` and let the client decide whether the version gap is acceptable. Alternatively, keep the guard but document that it follows the "agent can't support client version" error path from KB-02.
