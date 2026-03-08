# ISS-077 — Missing MCP capability declaration in agent initialize
**Severity**: Minor
**File**: `src/extensions/mcp/bridge.ts`
**KB Topic**: KB-06: MCP Capabilities

## Original Issue
`mcp: { http: false, sse: false }` should be declared in `agentCapabilities` during `initialize` but is not implemented. Clients may send HTTP/SSE server configs that will be silently dropped.

## Verification

### Source Code Check
Lines 222-241 of `bridge.ts`:
```typescript
// HTTP/SSE: not supported yet — log a warning and skip gracefully.
// ...
// NOTE: Agent capability declaration (`mcp: { http: false, sse: false }`) should
// be added to the agent descriptor in src/extensions/acp/agent.ts once that
// field is part of the ACP capability schema.
console.error(`[MCP] Skipping non-stdio server...`);
```
The code acknowledges the need to declare MCP transport capabilities but defers it. Non-stdio servers are silently skipped with only a console.error.

### ACP Spec Check
KB-06 defines MCP transport type declaration:
```json
{
  "agentCapabilities": {
    "mcp": {
      "http": true,
      "sse": true
    }
  }
}
```
The agent should declare which transports it supports so clients know not to send unsupported server configurations.

### Verdict: CONFIRMED
The agent does not declare its MCP transport capabilities during initialization. Clients have no way to know that HTTP/SSE servers will be silently dropped. The code itself documents this as a known gap.

## Remediation
1. Add `mcp: { http: false, sse: false }` to the agent capabilities declared during `initialize`.
2. This should be added in `src/extensions/acp/agent.ts` in the initialize response.
