# ISS-024: Tool name parse/unparse asymmetry with double-underscore server names

**Source**: `src/extensions/mcp/tool-proxy.ts` (lines 128-136)
**KB Reference**: KB-06: Tool Namespacing
**Severity**: Medium

### Verdict: CONFIRMED

**Finding**: `_parseToolName` splits on the first occurrence of `__` (the `NAME_SEP` constant). If a server ID contains `__`, the parse produces incorrect results:

- Server `my__server` + tool `read` -> composed name `my__server__read`
- Parsing `my__server__read` -> serverId=`my`, rawToolName=`server__read` (WRONG)

KB-06 states that MCP server names are used for tool namespacing (line 411: "name: string; // Logical name; used for tool namespacing"). Using `__` as a separator without constraining server names creates an ambiguous encoding.

The `indexOf` approach finds the FIRST `__`, but the compose operation appends `serverId + '__' + toolName`, so a correct parse would need to find the LAST `__` (or the separator must be guaranteed unique).

### Remediation

1. **Option A**: Use `lastIndexOf` instead of `indexOf` for parsing (assumes tool names don't contain `__`)
2. **Option B**: Validate server names at registration time to reject names containing `__`
3. **Option C**: Use a separator that cannot appear in MCP identifiers (e.g., `:::` or a single control character)
