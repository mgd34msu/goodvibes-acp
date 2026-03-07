# ISS-148 — _stopTcpServer Sets _tcpServer = null Before Close Callback Fires

**Severity**: Minor
**File**: src/extensions/lifecycle/daemon.ts
**KB Topic**: Initialization

## Original Issue
`_stopTcpServer()` sets `this._tcpServer = null` before close callback fires — state inconsistency during close.

## Verification

### Source Code Check
Lines 238–248 of `src/extensions/lifecycle/daemon.ts`:

```typescript
private _stopTcpServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!this._tcpServer) {
      resolve();
      return;
    }
    this._tcpServer.close(() => resolve());
    this._tcpServer = null;  // ← set null BEFORE close callback fires
  });
}
```

The `null` assignment happens synchronously after calling `.close()`, but before the close callback (which calls `resolve()`) has fired. During the window between `close()` being called and the callback firing, `this._tcpServer` is `null` even though the server has not yet fully closed. Any concurrent call to `_stopTcpServer()` would short-circuit via the `if (!this._tcpServer)` guard, returning immediately without waiting for the actual close — leading to a race condition where callers believe the server is stopped when it is still closing.

### ACP Spec Check
The ACP spec does not define requirements for internal TCP server state management during daemon shutdown. This is an implementation detail of the runtime daemon, not an ACP wire-format concern.

### Verdict: NOT_ACP_ISSUE
The code has the problem described — state inconsistency during TCP server close is a real concurrency bug. However, it is entirely internal to the daemon lifecycle implementation and has no bearing on ACP protocol compliance.

## Remediation
Set `this._tcpServer = null` inside the close callback, after the server has actually closed:

```typescript
private _stopTcpServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!this._tcpServer) {
      resolve();
      return;
    }
    this._tcpServer.close(() => {
      this._tcpServer = null;  // ← set null AFTER close completes
      resolve();
    });
  });
}
```

This ensures `_tcpServer` is null only when the server is fully closed, preventing the race condition.
