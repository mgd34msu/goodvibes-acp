# ISS-088: MCP initialize handshake discards server capabilities

**Severity**: Major
**File**: src/extensions/mcp/transport.ts
**Line(s)**: 119-128
**Topic**: Tools & MCP

## Issue Description
MCP initialize handshake does not capture or expose server capabilities (`serverCapabilities: { tools, resources, prompts }`). Initialize response is discarded.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/06-tools-mcp.md lines 460, 594
- **Spec Says**: "MCP Server -> Agent: initialize response (serverCapabilities: { tools, resources, prompts })". The spec shows checking capabilities before operations: "Check capability first (from initialize response)" (line 594). Server capabilities determine which features (tools, resources, prompts) the MCP server supports.
- **Confirmed**: Yes
- **Notes**: Without capturing capabilities, the agent cannot know which features the MCP server supports, leading to potential calls to unsupported endpoints.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 119-128 show `initialize()` calls `await this._request('initialize', {...})` but does NOT capture the return value. The response (which contains `serverCapabilities`) is discarded. The method only sends the `notifications/initialized` notification and sets `this._ready = true`. No `serverCapabilities` field exists on the transport class.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Capture the initialize response: `const result = await this._request('initialize', {...})`
2. Store server capabilities: `this._serverCapabilities = result.capabilities`
3. Expose capabilities via a getter: `get serverCapabilities()`
4. Optionally check capabilities before making tool/resource/prompt calls
