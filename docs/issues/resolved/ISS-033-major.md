# ISS-033: session/new does not persist mcpServers in session config

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**Line(s)**: 140-143
**Topic**: Sessions

## Issue Description
`session/new` does not forward `mcpServers` to session config. MCP servers are connected via mcpBridge but not persisted in the session's `config.mcpServers` field.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md, lines 487-496
- **Spec Says**: On `session/load`, MCP server config can differ. The Agent reconnects to whatever servers are provided. This implies the original servers should be persisted so they can be compared or restored.
- **Confirmed**: Partial
- **Notes**: The spec does not explicitly mandate persisting mcpServers in session config, but the session/load flow implies the agent should know what was originally configured. The KB notes that "MCP server config can differ between original and resumed session."

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: At lines 140-146, the code DOES pass `mcpServers` to `sessions.create()` via the spread: `...(params.mcpServers && params.mcpServers.length > 0 ? { mcpServers: params.mcpServers as unknown as MCPServerConfig[] } : {})`. However, the `as unknown as MCPServerConfig[]` cast suggests a type mismatch between ACP SDK types and internal types, which could cause data loss during serialization.
- **Issue Confirmed**: Partial

## Verdict
PARTIAL

## Remediation Steps
1. Verify that `SessionManager.create()` actually persists the `mcpServers` field in the stored session context
2. Fix the unsafe `as unknown as MCPServerConfig[]` cast — properly map ACP SDK MCP server types to internal types
3. Confirm mcpServers survive round-trip through store serialization
