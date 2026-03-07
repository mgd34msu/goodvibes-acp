# ISS-029: No protocol version negotiation in initialize

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**Line(s)**: 109-113
**Topic**: Initialization

## Issue Description
No protocol version negotiation. Client sends highest supported version; agent must respond with version <= client's version, or error if incompatible. Add version comparison and `-32600` error path.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 02-initialization.md lines 203-226, 467-484
- **Spec Says**: "Client sends HIGHEST version it supports. Agent MUST respond with version <= client's version. If agent can't support any client version, return error." The error should use JSON-RPC code `-32600` (Invalid Request) with data including `requestedVersion` and `supportedVersions`. Version is a single integer (MAJOR only), currently `1`.
- **Confirmed**: Yes
- **Notes**: This is a MUST-level requirement in the spec.

### Source Code Check
- **Code Exists**: Yes (initialize method exists, but no negotiation logic)
- **Code Shows**: Line 113 returns `protocolVersion: PROTOCOL_VERSION` as a hardcoded constant without any comparison to `params.protocolVersion`. The agent does not check if the client's version is compatible, does not negotiate down, and does not return an error for incompatible versions. If a client sends `protocolVersion: 0` (an older version), the agent would respond with a higher version, violating the spec.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add version negotiation logic before the return statement:
```typescript
const SUPPORTED_VERSION = 1;
if (params.protocolVersion < SUPPORTED_VERSION) {
  throw {
    code: -32600,
    message: 'Unsupported protocol version',
    data: {
      requestedVersion: params.protocolVersion,
      supportedVersions: [SUPPORTED_VERSION],
    },
  };
}
```
2. Return `protocolVersion: Math.min(params.protocolVersion, SUPPORTED_VERSION)` to negotiate down properly
