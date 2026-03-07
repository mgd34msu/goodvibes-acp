# ISS-010: `MCPServerConfig` uses non-ACP transport model

**Severity**: Critical
**File**: src/types/session.ts
**Line(s)**: 30-43
**Topic**: Sessions

## Issue Description
`MCPServerConfig` uses a non-ACP transport model. Spec defines `StdioMcpServer { name, command, args, env: EnvVariable[] }` and `HttpMcpServer { type, name, url, headers }`. Implementation uses a union on transport type with optional host/port and no `env`. Remodel as discriminated union matching wire format.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md lines 175-231
- **Spec Says**: Two MCP server types:
  - `StdioMcpServer { name: string; command: string; args: string[]; env?: EnvVariable[]; }` (no `type` field -- stdio is the default)
  - `HttpMcpServer { type: "http"; name: string; url: string; headers: HttpHeader[]; }` (discriminated by `type: "http"`)
  - `EnvVariable { name: string; value: string; }`
  - `HttpHeader { name: string; value: string; }`
- **Confirmed**: Yes
- **Notes**: The implementation's transport model is incompatible with ACP in multiple ways: (1) uses `transport: 'stdio' | 'tcp' | 'websocket'` instead of spec's implicit stdio / `type: "http"` discriminator, (2) missing `env` for stdio servers, (3) uses `host`/`port` instead of `url` for network transports, (4) no `headers` for HTTP transport.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 30-43 define `MCPServerConfig` as a single type with `transport: 'stdio' | 'tcp' | 'websocket'`, optional `command`, `args`, `host`, `port`. No `env` field for environment variables. No `url` or `headers` fields for HTTP transport. The `as unknown as` casts in agent.ts (lines 144, 193) confirm the type mismatch is known.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
The `MCPServerConfig` type does not match either ACP MCP server type. The casts to `unknown` in agent.ts confirm the structural incompatibility. This means:
- Environment variables cannot be passed to stdio MCP servers
- HTTP MCP servers cannot be configured with URLs and auth headers
- The `tcp` and `websocket` transport types have no ACP equivalent

## Remediation Steps
1. Define `EnvVariable = { name: string; value: string; }`
2. Define `StdioMcpServer = { name: string; command: string; args: string[]; env?: EnvVariable[]; }`
3. Define `HttpHeader = { name: string; value: string; }`
4. Define `HttpMcpServer = { type: 'http'; name: string; url: string; headers: HttpHeader[]; }`
5. Define `McpServer = StdioMcpServer | HttpMcpServer` as a discriminated union
6. Replace `MCPServerConfig` with `McpServer` throughout the codebase
7. Remove the `as unknown as` casts in agent.ts
