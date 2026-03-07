# ISS-163 — AcpStream Coupled to SDK Implementation Detail

**Severity**: Nitpick
**File**: src/extensions/acp/transport.ts:53
**KB Topic**: Overview

## Original Issue
**[src/extensions/acp/transport.ts:53]** `AcpStream` defined as `ReturnType<typeof acp.ndJsonStream>` — couples the type to SDK implementation detail. Define explicitly based on spec Stream type, or add a type assertion. *(Overview)*

## Verification

### Source Code Check
```typescript
/** The bidirectional stream accepted by AgentSideConnection */
export type AcpStream = ReturnType<typeof acp.ndJsonStream>;
```
The type is derived from the SDK function return type rather than defined structurally. If the SDK changes the return type of `ndJsonStream()`, `AcpStream` would silently change.

### ACP Spec Check
The ACP specification defines bidirectional stream communication using ndjson (newline-delimited JSON) format over transport types (stdio, HTTP, WebSocket). The spec does not prescribe how the TypeScript SDK should define or name the stream type. TypeScript type definition patterns are implementation choices, not protocol mandates.

### Verdict: NOT_ACP_ISSUE
The use of `ReturnType<typeof acp.ndJsonStream>` is a TypeScript style concern. Using `ReturnType` is a legitimate pattern — it keeps the local type in sync with the SDK automatically. The alternative (explicit structural typing) could drift out of sync with the SDK. Neither approach violates the ACP spec. This is a maintainability preference, not a compliance issue.

## Remediation
N/A — Not an ACP compliance issue.

For code quality improvement (optional):
- If SDK stability is a concern, define the type structurally based on the `AgentSideConnection` constructor parameter type
- Add a comment explaining why `ReturnType` is used intentionally
