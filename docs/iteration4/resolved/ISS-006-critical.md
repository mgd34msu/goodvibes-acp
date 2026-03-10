# ISS-006 — stderr pipe pollutes ACP ndjson transport
**Severity**: Critical
**File**: `src/extensions/mcp/transport.ts`
**KB Topic**: KB-06: MCP Transport

## Original Issue
`child.stderr?.pipe(process.stderr)` forwards MCP server stderr directly to the agent's stderr. MCP servers can emit noisy debug output that will intermingle with agent diagnostic output. Certain client implementations may capture stderr for error display.

## Verification

### Source Code Check
`src/extensions/mcp/transport.ts` line 267:
```
child.stderr?.pipe(process.stderr);
```
This pipes MCP server stderr directly to the agent's stderr stream without any filtering or routing through the EventBus.

### ACP Spec Check
ACP uses ndjson over stdin/stdout for the transport layer. While stderr is not the ndjson channel, the ACP transport model expects clean separation between protocol messages and diagnostic output. MCP servers are known to emit verbose debug output on stderr that can confuse operators or client implementations that capture stderr.

KB-06 does not explicitly forbid stderr forwarding, but the implementation should route operational output through structured channels (EventBus) to maintain clean diagnostic separation.

### Verdict: CONFIRMED
The direct stderr pipe forwards unstructured MCP server output to the agent's stderr stream. This pollutes diagnostic output and can confuse client implementations that capture stderr for error reporting.

## Remediation
1. Replace `child.stderr?.pipe(process.stderr)` with a buffered reader that routes lines through the EventBus as `mcp:stderr` events.
2. Optionally filter or prefix stderr lines with the MCP server name for disambiguation.
3. Allow configuration to suppress or redirect MCP server stderr.
