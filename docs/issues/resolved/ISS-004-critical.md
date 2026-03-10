# ISS-004 — `session/load` ignores incoming `cwd` and `mcpServers` from request params
**Severity**: Critical
**File**: `src/extensions/acp/agent.ts`
**KB Topic**: KB-03: Sessions

## Original Issue
`loadSession()` uses `context.config.mcpServers` from the original session, ignoring `params.mcpServers` and `params.cwd` from the `LoadSessionRequest`. KB-03 states: "MCP server config can differ between original and resumed session."

## Verification

### Source Code Check
`src/extensions/acp/agent.ts` lines 296-305 show:
```
if (this.mcpBridge && context.config.mcpServers && context.config.mcpServers.length > 0) {
  const connections = await this.mcpBridge.connectServers(
    context.config.mcpServers as unknown as schema.McpServer[],
  );
```
The code uses `context.config.mcpServers` (stored session config) instead of `params.mcpServers` (from the load request). There is no reference to `params.cwd` or `params.mcpServers` in the loadSession method.

### ACP Spec Check
SDK `LoadSessionRequest` (types.gen.d.ts:1224-1247) includes `mcpServers` as a parameter. KB-03 and KB-06 both state that MCP servers should be reconnected from the load request params, not stored config, since the client may provide different servers on resume.

### Verdict: CONFIRMED
The code ignores `params.mcpServers` and `params.cwd` from the `LoadSessionRequest`, using stored session config instead. This violates the ACP spec requirement that agents use the load request params.

## Remediation
1. Use `params.mcpServers` instead of `context.config.mcpServers` when reconnecting MCP servers.
2. Update the session's `cwd` from `params.cwd` if provided in the load request.
3. Fall back to stored config only if the load request omits these fields.
