# ISS-068: disconnect() does not await subprocess exit

**Severity**: Minor  
**File**: `src/extensions/mcp/bridge.ts`  
**Lines**: 91-97  
**KB Reference**: KB-06 (MCP)  
**Issue Source**: docs/issues-combined.md #68

## Description

The `disconnect()` method in McpBridge calls `conn.client.close()` which internally calls `this._process.kill()` (transport.ts line 173). This is fire-and-forget — the method returns immediately without waiting for the subprocess to actually exit. MCP server processes may still be running when session shutdown is reported complete.

### Verdict: CONFIRMED

`McpClient.close()` (transport.ts lines 170-175) sets `_closed = true` and calls `this._process.kill()`. There is no await of the process `exit` event. The bridge's `disconnect()` (bridge.ts line 94) calls `conn.client.close()` synchronously and immediately deletes the connection from the map.

During shutdown, `disconnectAll()` (line 107-110) calls `disconnect()` via `Promise.allSettled`, but since each disconnect is synchronous, the allSettled resolves immediately while subprocess cleanup is still in progress.

## Remediation

1. Add a `closeAsync()` method to `McpClient` that returns a Promise resolving on the `exit` event
2. Add a timeout guard to prevent hanging on unresponsive processes
3. Update `McpBridge.disconnect()` to await the async close

```typescript
// In McpClient:
async closeAsync(timeoutMs = 5000): Promise<void> {
  if (this._closed) return;
  this._closed = true;
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      this._process.kill('SIGKILL');
      resolve();
    }, timeoutMs);
    this._process.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    this._process.kill();
  });
}
```
