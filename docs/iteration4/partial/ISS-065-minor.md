# ISS-065: JSON parse errors in MCP transport silently consumed

**Severity**: Minor  
**File**: `src/extensions/mcp/transport.ts`  
**Lines**: 99-103  
**KB Reference**: KB-06 (MCP)  
**Issue Source**: docs/issues-combined.md #65

## Description

Non-JSON lines from MCP servers are caught in the JSON.parse catch block (lines 99-103) and logged at `console.debug` level only. Persistent parse failures indicating a malfunctioning MCP server are not surfaced.

### Verdict: PARTIAL

The code does log non-JSON lines at debug level (line 102: `console.debug('[McpClient] ignoring non-JSON line:', trimmed.substring(0, 100))`), so they are not completely silent. However, there is no mechanism to:
- Count consecutive failures
- Escalate to a warning/error after a threshold
- Emit a structured `mcp:error` event

A malfunctioning server sending persistent garbage would only be visible in debug logs, which are typically suppressed in production.

## Remediation

1. Add a consecutive parse failure counter to `McpClient`
2. After a configurable threshold (e.g., 10 consecutive failures), emit an `mcp:error` event or escalate log level to `warn`
3. Optionally: close the connection after excessive failures

```typescript
private _consecutiveParseFailures = 0;

// In the catch block:
this._consecutiveParseFailures++;
if (this._consecutiveParseFailures > 10) {
  this.emit('error', new Error(`MCP server sending persistent non-JSON output (${this._consecutiveParseFailures} failures)`));
}
```
