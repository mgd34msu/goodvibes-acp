# ISS-030: Race condition in _stopHealthServer — server nulled before close completes

**Source**: `src/extensions/lifecycle/daemon.ts` (line 289)
**KB Reference**: KB-10: Graceful Shutdown
**Severity**: Medium

### Verdict: CONFIRMED

**Finding**: In `_stopHealthServer()`, the code sets `this._healthServer = null` immediately after calling `this._healthServer.close()`, before the close callback fires:

```typescript
private _stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!this._healthServer) { resolve(); return; }
    this._healthServer.close(() => resolve());
    this._healthServer = null;  // Nulled BEFORE close completes
  });
}
```

Meanwhile, `_stopTcpServer()` in the same file (line 246) correctly captures the reference before nulling:

```typescript
private _stopTcpServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!this._tcpServer) { resolve(); return; }
    const server = this._tcpServer;  // Capture reference
    this._tcpServer = null;          // Null the field
    server.close(() => resolve());   // Close via captured ref
  });
}
```

If `stop()` is called twice rapidly, the second call sees `this._healthServer` as null and resolves immediately while the first close may still be in-flight. KB-10 emphasizes graceful shutdown with proper cleanup sequencing.

### Remediation

1. Mirror the `_stopTcpServer` pattern — capture the reference before nulling:

```typescript
private _stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!this._healthServer) { resolve(); return; }
    const server = this._healthServer;
    this._healthServer = null;
    server.close(() => resolve());
  });
}
```
