# ISS-080 — `tool-proxy.ts` `_parseToolName` fragile on `__` in server names
**Severity**: Low
**File**: `src/extensions/mcp/tool-proxy.ts`
**KB Topic**: KB-06: MCP

## Original Issue
Splits on first `__`. If server ID contains `__`, split is incorrect.

## Verification

### Source Code Check
`src/extensions/mcp/tool-proxy.ts` lines 127-136:
```
private _parseToolName(toolName: string): { serverId: string | null; rawToolName: string | null } {
  const idx = toolName.indexOf(NAME_SEP);
  if (idx === -1) {
    return { serverId: null, rawToolName: toolName };
  }
  return {
    serverId: toolName.slice(0, idx),
    rawToolName: toolName.slice(idx + NAME_SEP.length),
  };
}
```
With `NAME_SEP = '__'` (line 23), the code splits on the first occurrence of `__`. If a server ID contains `__` (e.g., `my__server__toolName`), the split would incorrectly parse `my` as the server ID and `server__toolName` as the tool name.

### ACP Spec Check
KB-06 describes MCP tool integration but does not specify a naming convention for prefixed tool names. The `__` separator is a GoodVibes implementation choice. The fragility exists if server names are not validated during registration.

### Verdict: PARTIAL
The parsing logic itself is reasonable (split on first `__`), but there is no validation during server registration to prevent server names containing `__`. If such names are registered, the parsing would produce incorrect results. This is an implementation robustness issue rather than a direct ACP protocol violation.

## Remediation
1. Validate server names during registration to reject names containing `__`.
2. Document the naming convention constraint for MCP server IDs.
