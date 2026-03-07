# ISS-004: MCP capability uses wrong key `mcpCapabilities` instead of `mcp`

**Severity**: Critical
**File**: src/extensions/acp/agent.ts
**Line(s)**: 118-126
**Topic**: Initialization

## Issue Description
MCP capability uses wrong key `mcpCapabilities` instead of `mcp`. Wire format requires `mcp: { http: boolean, sse: boolean }`. Also applies to `promptCapabilities` -> `prompt`. The incorrect keys are silently ignored by compliant clients.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/02-initialization.md lines 175-198; docs/acp-knowledgebase/01-overview.md lines 258-275
- **Spec Says**: `AgentCapabilities` defines `mcp?: { http?: boolean; sse?: boolean; }` and `promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean; }`
- **Confirmed**: Partial
- **Notes**: The issue correctly identifies that `mcpCapabilities` should be `mcp`. However, the claim that `promptCapabilities` should be `prompt` is INCORRECT -- the spec uses `promptCapabilities` as the key name. Only the MCP key is wrong.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 120 uses `mcpCapabilities: { http: false, sse: false }` (WRONG -- should be `mcp`). Lines 121-125 use `promptCapabilities: { embeddedContext: true, image: false, audio: false }` (CORRECT -- matches spec).
- **Issue Confirmed**: Partial

## Verdict
PARTIAL
The `mcpCapabilities` key is confirmed wrong -- it should be `mcp`. However, `promptCapabilities` is already the correct key per the spec; the issue's claim that it should be `prompt` is a hallucination. Clients will silently ignore `mcpCapabilities`, meaning the agent will never be offered HTTP/SSE MCP servers.

## Remediation Steps
1. Change `mcpCapabilities` to `mcp` at line 120
2. Do NOT change `promptCapabilities` -- it is already correct per spec
