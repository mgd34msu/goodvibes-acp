# ISS-030 — Daemon Silently Accepts Connections With No ACP Handler

**Severity**: Major
**File**: src/extensions/lifecycle/daemon.ts:228-231
**KB Topic**: Initialization (02-initialization.md)

## Original Issue
When no `onConnection` handler is provided in `DaemonOptions`, connections are accepted and held open indefinitely with only an error listener. No `initialize` response is ever sent.

## Verification

### Source Code Check
Lines 228-231 of `daemon.ts` (adjusted for current file state):
```typescript
if (this._options?.onConnection) {
  this._options.onConnection(socket);
} else {
  // Fallback: keep socket open until closed by the client.
  socket.on('error', () => socket.destroy());
}
```
When `onConnection` is not provided, the code falls through to a fallback that only attaches an error handler. The socket is kept open indefinitely with no ACP transport wiring. No `initialize` response can ever be sent because no `AgentSideConnection` is created for the socket.

### ACP Spec Check
KB-02 (02-initialization.md) states:
- The initialization phase is **mandatory** before any session can be created
- The client sends `initialize` as the **first message** on the connection
- The agent must respond with `InitializeResponse` containing `protocolVersion` and `agentCapabilities`

A connection that never receives ACP transport wiring can never respond to `initialize`, leaving the client in a permanent waiting state.

### Verdict: CONFIRMED
The code silently accepts TCP connections and holds them open with no ACP handler when `onConnection` is not provided. This creates zombie connections that can never complete the ACP initialization handshake. The fallback behavior should either refuse connections or provide a minimal ACP error response.

## Remediation
1. When `onConnection` is not provided, either:
   - **Option A**: Refuse the connection immediately with `socket.destroy()` and log a warning
   - **Option B**: Send a JSON-RPC error response and close: `{"jsonrpc":"2.0","id":0,"error":{"code":-32603,"message":"Agent not configured"}}`
2. Add a warning log when daemon starts without an `onConnection` handler, since it means no connections can be serviced
3. Consider making `onConnection` a required field in `DaemonOptions` to prevent this at the type level
