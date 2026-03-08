# ISS-007 — Missing `mcpCapabilities` declaration in agent initialize response
**Severity**: Critical
**File**: `src/extensions/mcp/bridge.ts`
**KB Topic**: KB-06: MCP

## Original Issue
The agent MUST declare `agentCapabilities.mcp: { http: boolean, sse: boolean }` during `initialize` so clients know which MCP transports are supported. Only a comment acknowledges this gap.

## Verification

### Source Code Check
`src/extensions/mcp/bridge.ts` lines 231-238 contain comments:
```
// NOTE: Agent capability declaration (`mcp: { http: false, sse: false }`) should
// be added to the agent descriptor in src/extensions/acp/agent.ts once that
// field is part of the ACP capability schema.
```
The code explicitly acknowledges the gap but does not implement it.

### ACP Spec Check
SDK `McpCapabilities` type (types.gen.d.ts:1286-1305) exists. SDK `AgentCapabilities` (types.gen.d.ts:9-33) defines the structure for agent capability declaration. KB-06 states the agent should declare `mcp: { http: boolean, sse: boolean }` during initialize so clients know which MCP transports are supported.

### Verdict: CONFIRMED
The agent does not declare `mcpCapabilities` in the initialize response. Clients cannot determine which MCP transport types the agent supports. The code contains comments acknowledging this gap.

## Remediation
1. Add `mcp: { http: false, sse: false }` to the agent's `agentCapabilities` in the initialize response.
2. Update when HTTP/SSE transport support is added.
