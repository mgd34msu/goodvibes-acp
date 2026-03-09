# ISS-024 — No `conn.signal` integration for graceful teardown

**Severity**: Major
**File**: `src/main.ts`
**Lines**: N/A (missing)
**KB Reference**: KB-10 (Implementation)

## Description

KB-10 implementation checklist requires: "`conn.signal` abort triggers graceful teardown." The codebase handles `SIGINT`/`SIGTERM` for process-level shutdown but does not listen for the ACP connection's abort signal. In subprocess mode, if the client closes stdin (drops the ACP connection), the agent process does not initiate shutdown and may hang indefinitely.

Grepping for `conn.signal` or `connection.signal` in `main.ts` returns zero matches.

### Verdict: CONFIRMED

KB-10 line 1138 explicitly lists this as a requirement. The source has no `conn.signal` listener. The daemon mode creates a connection at line ~507 but only listens for `conn.closed` (for logging), not `conn.signal` for teardown.

## Remediation

1. After `createConnection(stream)`, register an abort listener on `conn.signal`:
   ```typescript
   conn.signal.addEventListener('abort', () => {
     shutdownManager.shutdown('connection-abort');
   });
   ```
2. Apply this in both stdio mode and daemon mode (per-connection)
3. Ensure the shutdown is graceful (flush pending writes, close MCP connections, save state)
