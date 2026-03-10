# Wave 1 Review — Agent 9: Lifecycle & Daemon

**Reviewer**: ACP Compliance Review Agent  
**Files reviewed**:  
- `src/extensions/lifecycle/daemon.ts`  
- `src/extensions/lifecycle/shutdown.ts`  
- `src/extensions/lifecycle/health.ts`  
- `src/extensions/lifecycle/index.ts`  
- `src/main.ts` (lifecycle wiring, lines 116–559)  

**KB references**: `10-implementation-guide.md` (sections 14 checklist, error handling), `02-initialization.md` (stderr logging, line 508), `03-sessions.md`

---

## Issues

### 1. Health endpoint not integrated with HealthCheck module
**File**: `src/extensions/lifecycle/daemon.ts:66-73`  
**KB**: `10-implementation-guide.md` — health/readiness pattern  
**Severity**: HIGH  

The daemon's `/health` HTTP endpoint returns a static `{ status: 'ok' }` response and never queries `HealthCheck.check()`. The `HealthCheck` class (health.ts) tracks degraded status via sub-checks and has `starting`/`ready`/`degraded`/`shutting_down` states, but none of this is surfaced through the daemon's HTTP health endpoint. A runtime with a failing sub-check would still report `status: 'ok'` over HTTP.

**Fix**: Inject `HealthCheck` into `DaemonManager` (or into `handleHealthRequest`) and return `healthCheck.check()` from `/health`.

---

### 2. Health server stop has double-close race condition
**File**: `src/extensions/lifecycle/daemon.ts:292-300`  
**KB**: `10-implementation-guide.md` — graceful teardown  
**Severity**: MEDIUM  

`_stopHealthServer()` sets `this._healthServer = null` on line 299 *before* the `server.close()` callback fires. If `stop()` is called concurrently (e.g., signal + unhandled rejection), the second call sees `null` and resolves immediately while the first close is still in progress. In contrast, `_stopTcpServer()` correctly captures the reference before nulling (line 262-264).

**Fix**: Apply the same capture-then-null pattern used in `_stopTcpServer`:
```typescript
const server = this._healthServer;
this._healthServer = null;
server.close(() => resolve());
```

---

### 3. PID file written before socket binding
**File**: `src/extensions/lifecycle/daemon.ts:143-146`  
**KB**: `10-implementation-guide.md` — daemon bootstrap  
**Severity**: MEDIUM  

The PID file is written *before* TCP and health servers bind. While the catch block (ISS-031) cleans up the PID file on bind failure, there is a race window where a monitoring tool reads the PID file but the process is not yet accepting connections. The ACP-idiomatic pattern is: bind first, then write the PID file to signal readiness.

**Fix**: Move `writeFile(options.pidFile, ...)` after both servers have successfully bound (after line 154).

---

### 4. No conn.signal integration for graceful teardown
**File**: `src/main.ts` (missing)  
**KB**: `10-implementation-guide.md:1138` — "`conn.signal` abort triggers graceful teardown"  
**Severity**: HIGH  

The KB implementation checklist requires that `conn.signal` abort triggers graceful teardown. The codebase handles `SIGINT`/`SIGTERM` (line 439-440) but does not listen for `conn.signal.addEventListener('abort', ...)` on any `AgentSideConnection`. In subprocess mode, if the client closes stdin (triggering connection abort), no shutdown is initiated — the process hangs until the event loop drains naturally.

**Fix**: In both subprocess and daemon modes, listen for `conn.signal` abort and trigger `shutdownManager.shutdown()`.

---

### 5. Force exit timeout conflicts with per-handler timeout
**File**: `src/main.ts:436`  
**KB**: `10-implementation-guide.md` — graceful shutdown  
**Severity**: MEDIUM  

The clean `shutdown()` function sets `setTimeout(() => process.exit(0), 2000)`. However, `ShutdownManager._runWithTimeout` allows 10 seconds per handler (line 20 of shutdown.ts), and there are 10+ handlers registered. The 2-second force exit will fire long before all handlers complete, potentially interrupting mid-shutdown operations (e.g., ACP session finish events, memory save, MCP disconnect).

**Fix**: Either increase the outer timeout to exceed the total possible handler time (e.g., 30s), or remove it and rely on `ShutdownManager` completing naturally. Keep the 5s safety timeout only for uncaught exception / unhandled rejection paths.

---

### 6. Shutdown not idempotent at the main.ts level
**File**: `src/main.ts:430-440`  
**KB**: `10-implementation-guide.md` — signal handling  
**Severity**: LOW  

Container orchestrators commonly send SIGTERM then SIGINT (or vice versa). Both signals call `shutdown()` which calls `healthCheck.markShuttingDown()` and `shutdownManager.shutdown()`. While `ShutdownManager.shutdown()` is internally idempotent (returns early if `_isShuttingDown`), the outer `shutdown()` in main.ts fires `setTimeout(() => process.exit(0), 2000)` unconditionally each time, creating multiple competing exit timers.

**Fix**: Guard with a module-level `let shuttingDown = false` flag; return early on subsequent calls.

---

### 7. No post-bind error handler on TCP server
**File**: `src/extensions/lifecycle/daemon.ts:244-246`  
**KB**: `10-implementation-guide.md` — error handling checklist  
**Severity**: MEDIUM  

The TCP server registers `server.once('error', reject)` for the initial bind. After successful bind, the `once` listener is consumed and no further error handler is attached. Post-bind errors (e.g., ECONNRESET from a misbehaving client) will emit an unhandled `'error'` event, crashing the process.

**Fix**: After successful bind, attach a persistent error handler:
```typescript
server.on('error', (err) => {
  this._eventBus.emit('daemon:error', { error: err.message });
});
```

---

### 8. Hardcoded protocolVersion in health endpoint
**File**: `src/extensions/lifecycle/daemon.ts:71`  
**KB**: `02-initialization.md`, `09-typescript-sdk.md` — use `PROTOCOL_VERSION` constant  
**Severity**: LOW  

The `/health` response hardcodes `protocolVersion: 1`. The codebase defines `ACP_PROTOCOL_VERSION` in `src/types/constants.ts` and imports `PROTOCOL_VERSION` from the SDK in `agent.ts`. The health endpoint should reference the same constant to avoid version drift.

**Fix**: Import and use `ACP_PROTOCOL_VERSION` from `src/types/constants.ts`.

---

### 9. No active session draining before forced exit
**File**: `src/extensions/lifecycle/shutdown.ts`  
**KB**: `10-implementation-guide.md` — session finish events, cancel flow  
**Severity**: MEDIUM  

`ShutdownManager` has no mechanism to wait for in-flight sessions to complete or to signal active WRFC loops to cancel via AbortController. The `acp-sessions` handler in main.ts sends finish events but does not wait for active prompt processing to complete. An agent mid-WRFC-cycle will have its work abruptly terminated rather than reaching a safe checkpoint.

**Fix**: Before sending finish events, abort all active session `cancelController`s and wait (with timeout) for prompt processing to complete.

---

### 10. console.warn used instead of process.stderr.write
**File**: `src/extensions/lifecycle/daemon.ts:239`, `src/extensions/lifecycle/shutdown.ts:116`  
**KB**: `02-initialization.md:508` — "Agent logs... to stderr (not stdout) for debugging"  
**Severity**: LOW  

`console.warn` routes to stderr in Node.js/Bun, so this is technically compliant. However, the KB examples consistently use `console.error` for diagnostic output, and other parts of the codebase (main.ts) follow this convention. Using `console.warn` creates inconsistency — a code reviewer might question whether the author intended stdout output.

**Fix**: Replace `console.warn` with `console.error` for consistency with KB guidance and the rest of the codebase.

---

## Summary

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | Health endpoint ignores HealthCheck module | HIGH | daemon.ts:66-73 |
| 2 | Health server stop race condition | MEDIUM | daemon.ts:292-300 |
| 3 | PID file written before socket binding | MEDIUM | daemon.ts:143-146 |
| 4 | No conn.signal integration for teardown | HIGH | main.ts (missing) |
| 5 | Force exit timeout too short (2s vs 10s/handler) | MEDIUM | main.ts:436 |
| 6 | Shutdown not idempotent at main.ts level | LOW | main.ts:430-440 |
| 7 | No post-bind error handler on TCP server | MEDIUM | daemon.ts:244-246 |
| 8 | Hardcoded protocolVersion in health response | LOW | daemon.ts:71 |
| 9 | No active session draining before exit | MEDIUM | shutdown.ts |
| 10 | console.warn instead of console.error | LOW | daemon.ts:239, shutdown.ts:116 |

**HIGH**: 2 | **MEDIUM**: 5 | **LOW**: 3

## Overall Score: 6/10

The lifecycle subsystem has solid structural foundations — layered shutdown ordering, health check abstraction, daemon/subprocess dual-mode support, and PID file cleanup on bind failure. However, two high-severity gaps (health endpoint not reflecting actual runtime health, missing conn.signal teardown integration) and several medium-severity race conditions/timeout conflicts reduce confidence in production readiness. The shutdown path in particular needs hardening: the 2-second force exit conflicts with the 10-second per-handler budget, concurrent signals create competing exit timers, and active sessions are not drained before termination.
