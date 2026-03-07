# ISS-177 — `console.error` Used Directly Instead of Structured Logging

**Severity**: Minor (categorized as nitpick per issue list context)
**File**: src/extensions/mcp/bridge.ts:191
**KB Topic**: Tools & MCP

## Original Issue
Uses `console.error` directly instead of structured logging.

## Verification

### Source Code Check
Line 191:
```typescript
console.error(`[McpBridge] Failed to connect to MCP server "${serverId}": ${error}`);
```

This is inside a `catch` block in the `connect()` method. The error is also emitted via event bus (`this.eventBus.emit('mcp:error', { serverId, error })`), so the error IS surfaced to the system — just also logged to console directly.

### ACP Spec Check
The ACP specification does not define logging requirements, logging formats, or whether `console.error` is acceptable. This is a purely internal code quality/observability concern. The ACP spec says nothing about how agents log internal errors.

### Verdict: NOT_ACP_ISSUE
The issue is a valid code style/observability concern — structured logging (e.g., via a logger instance) is preferable to raw `console.error` for production systems. However, this has zero ACP protocol compliance implications. It is a nitpick on logging discipline.

## Remediation
N/A for ACP compliance. For code quality:
- Replace `console.error` with the project's structured logger (e.g., `this.logger.error(...)` or equivalent)
- Since the error is already emitted on the event bus, consider removing the `console.error` entirely and relying on a centralized error listener
