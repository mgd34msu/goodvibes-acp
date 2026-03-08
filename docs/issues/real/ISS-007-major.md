# ISS-007 — mcpCapabilities Field Name Wrong — Should Be mcp

**Severity**: Major
**File**: src/extensions/acp/agent.ts:207
**KB Topic**: Agent Capabilities / Initialization (01-overview.md lines 258-275; 02-initialization.md lines 186-190)

## Original Issue
The initialize response declares MCP capabilities under `mcpCapabilities` instead of `mcp`. Clients cannot detect MCP transport support.

## Verification

### Source Code Check
```typescript
// src/extensions/acp/agent.ts:207
mcpCapabilities: { http: false, sse: false },
```
The field is named `mcpCapabilities` in the initialize response.

### ACP Spec Check
KB-02 (02-initialization.md) lines 186-190:
```typescript
interface AgentCapabilities {
  mcp?: {
    http?: boolean;
    sse?: boolean;
  };
}
```

KB-01 (01-overview.md) lines 266-268:
```typescript
mcp?: {
  http?: boolean;
  sse?: boolean;
};
```

KB-01 line 367: `"mcp": { "http": true, "sse": true }`

The spec consistently uses `mcp` as the field name, never `mcpCapabilities`. Clients checking `agentCapabilities.mcp` will find `undefined` because the data is under a non-standard key.

### Verdict: CONFIRMED
The field name `mcpCapabilities` does not match the ACP spec field name `mcp`. Clients will not detect MCP transport support and may fail to send MCP server configurations during session/new.

## Remediation
1. Rename `mcpCapabilities` to `mcp` in the initialize response at agent.ts:207
2. Verify no other code references the `mcpCapabilities` field name (search project-wide)
