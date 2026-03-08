# ISS-066: MCP server notifications dropped

**Severity**: Minor  
**File**: `src/extensions/mcp/transport.ts`  
**Lines**: 83-104  
**KB Reference**: KB-06 (MCP)  
**Issue Source**: docs/issues-combined.md #66

## Description

MCP server notifications (JSON-RPC messages without an `id` field, such as `notifications/tools/list_changed`) are silently ignored. The line handler (lines 83-98) only processes messages where `typeof msg.id === 'number'`, which excludes all notifications. This causes stale tool lists when MCP servers dynamically add or remove tools.

### Verdict: CONFIRMED

Lines 87-97: The handler parses JSON, checks `typeof msg.id === 'number'`, and only resolves/rejects pending requests. Messages without `id` (notifications per JSON-RPC 2.0 spec) fall through silently. No event is emitted, no callback is invoked.

The MCP specification defines `notifications/tools/list_changed` as a server-initiated notification that should trigger a `tools/list` refresh. Without handling this, tool lists become stale after server-side changes.

## Remediation

1. Add notification detection after the response handling block
2. Emit events on the McpClient EventEmitter for known notifications
3. Handle at minimum `notifications/tools/list_changed` by triggering a tools/list refresh

```typescript
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    if (typeof msg.id === 'number') {
      // ... existing response handling ...
    } else if (msg.method && !('id' in msg)) {
      // Server notification
      this.emit('notification', { method: msg.method, params: msg.params });
    }
  } catch { /* ... */ }
});
```
