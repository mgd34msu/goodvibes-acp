# ISS-076 — MCP stderr pipe may pollute agent output
**Severity**: Minor
**File**: `src/extensions/mcp/transport.ts`
**KB Topic**: KB-01: Transport

## Original Issue
`child.stderr?.pipe(process.stderr)` forwards MCP server diagnostic output to the agent's stderr. If downstream components parse agent stderr, MCP noise could cause parse errors.

## Verification

### Source Code Check
Line 265 of `transport.ts`:
```typescript
child.stderr?.pipe(process.stderr);
```
MCP server stderr is directly piped to the agent process's stderr with no filtering, prefixing, or separate channel.

### ACP Spec Check
The ACP spec does not define specific requirements for how MCP server stderr should be handled. However, the concern is valid from an operational perspective: if the agent's stderr is parsed by tooling (e.g., for JSON-RPC error detection), MCP server diagnostic messages could cause false positives.

### Verdict: CONFIRMED
While not a strict ACP spec violation, piping MCP server stderr directly to the agent's stderr without any prefixing or filtering is a quality concern. MCP servers may output diagnostic messages, warnings, or debug info that could interfere with agent output parsing.

## Remediation
1. Prefix MCP stderr lines with the server name: `[mcp:${serverName}]`.
2. Alternatively, route MCP stderr to a separate log channel or event bus event (e.g., `mcp:stderr`).
3. Consider adding a configuration option to suppress MCP stderr forwarding.
