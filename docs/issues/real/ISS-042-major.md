# ISS-042: MCP Bridge only handles stdio, missing HTTP/SSE transport and capability declaration

**Severity**: Major
**File**: src/extensions/mcp/bridge.ts
**Line(s)**: 68, 197-219
**Topic**: Tools & MCP

## Issue Description
`connectServers` accepts `McpServer[]` including HTTP/SSE but `_createClient` only handles stdio. Also missing `agentCapabilities.mcp` declaration (`http: false, sse: false`) during ACP initialize.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/06-tools-mcp.md, lines 420-450
- **Spec Says**: Agent declares MCP transport support during `initialize` via `agentCapabilities.mcp: { http: boolean, sse: boolean }`. HTTP/SSE MCP servers use a `url` field instead of `command`. Stdio is the universal baseline.
- **Confirmed**: Yes
- **Notes**: The spec clearly defines the capability declaration format and HTTP/SSE server object shape.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `connectServers` (line 68) accepts `McpServer[]` typed from the SDK, which includes HTTP/SSE variants. `_createClient` (lines 197-219) only checks `'command' in server` for stdio and throws an error for all other transport types (lines 216-219). No `agentCapabilities.mcp` declaration exists in the agent's initialize response (verified by the issue referencing agent.ts).
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `mcp: { http: false, sse: false }` to the `agentCapabilities` in the initialize response (in agent.ts) to honestly declare that only stdio is supported.
2. Add a clear comment or log warning when HTTP/SSE servers are passed but not supported.
3. Optionally, implement HTTP/SSE transport support in `_createClient` by detecting `'url' in server` and using fetch-based or SSE-based MCP clients.
