# ISS-041: MCP Bridge env format mismatch (EnvVariable[] vs Record<string,string>)

**Severity**: Major
**File**: src/extensions/mcp/bridge.ts
**Line(s)**: 197-219
**Topic**: Tools & MCP

## Issue Description
`_createClient` handles MCP server `env` as `EnvVariable[]` (`{name, value}`) but spec shows `env` as `Record<string, string>`. Verify SDK type for `McpServerStdio.env` and align.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/06-tools-mcp.md, lines 409-416
- **Spec Says**: `MCPServer` interface defines `env?: Record<string, string>` — a plain key-value object, not an array of `{name, value}` objects.
- **Confirmed**: Yes
- **Notes**: The KB wire format examples (lines 377, 383) consistently show `env` as `{ "ALLOWED_DIRS": "/home/user/project" }` — a plain object, not an array.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 203-207 iterate `stdio.env` as an array with `for (const v of stdio.env ?? [])` and access `v.name` / `v.value`. The comment on line 205 explicitly states "EnvVariable has { name: string; value: string } shape". This is inconsistent with the spec's `Record<string, string>` format.
- **Issue Confirmed**: Partial

## Verdict
PARTIAL

## Remediation Steps
1. Check the actual `@agentclientprotocol/sdk` TypeScript type for `McpServerStdio.env`. If the SDK has updated to `Record<string, string>`, remove the array iteration entirely and pass `stdio.env` directly.
2. If the SDK still uses `EnvVariable[]`, this is a SDK-level discrepancy with the wire spec. Either way, the bridge should handle `Record<string, string>` to match the wire format, and convert if the SDK type differs.
3. Replace lines 203-207 with: `const env = stdio.env ?? {};` (if SDK matches spec) or add a normalization layer that handles both formats.
