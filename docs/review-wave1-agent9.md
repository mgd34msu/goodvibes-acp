# Wave 1 Review — Agent 9: Lifecycle & Daemon

**Reviewer:** goodvibes:reviewer  
**Scope:** `src/extensions/lifecycle/daemon.ts`, `src/extensions/lifecycle/health.ts`, `src/extensions/lifecycle/index.ts`, `src/extensions/lifecycle/shutdown.ts`, `src/main.ts`  
**KB References:** `02-initialization.md`, `10-implementation-guide.md`  
**ACP Spec:** `https://agentclientprotocol.com/llms-full.txt`  
**Date:** 2026-03-07

---

## Summary

The lifecycle subsystem is well-structured with clear separation between daemon management, health checking, and graceful shutdown. The `main.ts` composition root correctly wires all layers and handles both subprocess and daemon modes. Several issues remain around diagnostic output routing, a race condition in health server teardown, orphaned PID file on bind failure, and fragile SDK type casting.

**Score: 7.4/10** | **Issues: 0 critical, 4 major, 6 minor**

---

## Issues

### 1. Race condition in `_stopHealthServer` — server nulled before close completes

| Field | Value |
|-------|-------|
| **File** | `src/extensions/lifecycle/daemon.ts` |
| **Line** | 289 |
| **Severity** | Major |
| **KB Topic** | `10-implementation-guide.md` — Graceful shutdown |

**Problem:** `_stopHealthServer()` sets `this._healthServer = null` (line 290) before the `close()` callback fires, unlike `_stopTcpServer()` which correctly captures the reference before nulling (lines 253-255). If `stop()` is called twice in rapid succession, the second call sees `_healthServer` as null and resolves immediately, but the first close may still be in-flight.

**Fix:** Mirror the pattern used in `_stopTcpServer` — capture the reference, null the field, then call `close()` on the captured reference:
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

---

### 2. `console.warn` in daemon.ts writes to stderr — verify runtime behavior

| Field | Value |
|-------|-------|
| **File** | `src/extensions/lifecycle/daemon.ts` |
| **Line** | 230 |
| **Severity** | Minor |
| **KB Topic** | `02-initialization.md` — "Agent logs client capabilities to stderr (not stdout) for debugging" |

**Problem:** `console.warn` at line 230 logs when no `onConnection` handler is configured. In Node.js, `console.warn` writes to stderr, which is correct. However, this is inconsistent with the rest of the codebase which uses `console.error` for all diagnostic output. Using `console.warn` may behave differently in non-Node runtimes.

**Fix:** Replace `console.warn` with `console.error` for consistency with the ACP diagnostic output convention used throughout `main.ts`.

---

### 3. Health endpoint hardcodes `protocolVersion: 1` instead of using SDK constant

| Field | Value |
|-------|-------|
| **File** | `src/extensions/lifecycle/daemon.ts` |
| **Line** | 71 |
| **Severity** | Minor |
| **KB Topic** | `02-initialization.md` — Protocol Version Negotiation |

**Problem:** The `/health` endpoint response includes `protocolVersion: 1` as a hardcoded literal. The KB and implementation guide both reference `acp.PROTOCOL_VERSION` as the canonical source of truth. If the protocol version is bumped to 2, this health endpoint would report stale information.

**Fix:** Import and use `PROTOCOL_VERSION` from the ACP SDK, or reference the existing `RUNTIME_VERSION` import alongside it:
```typescript
import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
// ...
agent: { name: 'goodvibes', version: RUNTIME_VERSION, protocolVersion: PROTOCOL_VERSION },
```

---

### 4. PID file left orphaned if socket binding fails

| Field | Value |
|-------|-------|
| **File** | `src/extensions/lifecycle/daemon.ts` |
| **Line** | 144-146 |
| **Severity** | Major |
| **KB Topic** | `10-implementation-guide.md` — Daemon lifecycle |

**Problem:** The PID file is written (line 145) before TCP and health servers attempt to bind (lines 149-152). If either `_startTcpServer` or `_startHealthServer` throws (e.g., port already in use / EADDRINUSE), the `start()` method rejects but the PID file remains on disk. The `stop()` method is never called because `_running` was never set to `true`.

**Fix:** Wrap the startup in a try/catch that cleans up the PID file on failure:
```typescript
async start(options: DaemonOptions): Promise<void> {
  // ... existing guard ...
  this._options = options;
  const host = options.host ?? '127.0.0.1';
  const healthPort = options.healthPort ?? options.port + 1;

  if (options.pidFile) {
    await writeFile(options.pidFile, String(process.pid), 'utf-8');
  }

  try {
    await this._startTcpServer(host, options.port);
    await this._startHealthServer(host, healthPort);
  } catch (err) {
    // Clean up PID file and any partially started server
    if (options.pidFile) {
      await unlink(options.pidFile).catch(() => {});
    }
    await this._stopTcpServer();
    throw err;
  }

  this._running = true;
  // ... emit event ...
}
```

---

### 5. `console.warn` in shutdown.ts should use `console.error` for ACP compliance

| Field | Value |
|-------|-------|
| **File** | `src/extensions/lifecycle/shutdown.ts` |
| **Line** | 116 |
| **Severity** | Minor |
| **KB Topic** | `02-initialization.md` — Diagnostic output to stderr |

**Problem:** Same issue as #2. `console.warn` is used for shutdown handler failure logging. While it does go to stderr in Node.js, `console.error` is the consistent convention per ACP and KB.

**Fix:** Replace `console.warn` with `console.error`.

---

### 6. Fragile SDK type cast for finish event during shutdown

| Field | Value |
|-------|-------|
| **File** | `src/main.ts` |
| **Line** | 131 |
| **Severity** | Major |
| **KB Topic** | `10-implementation-guide.md` — Section 5: Prompt Handling, stop reasons |

**Problem:** The shutdown handler casts `{ sessionUpdate: 'finish', stopReason: 'cancelled' }` through `unknown` to `acp.SessionUpdate`. The comment acknowledges the SDK v0.15.0 type gap. This double-cast (`as unknown as T`) silences all type checking and will not produce a compile error if the actual wire format changes in a future SDK version.

**Fix:** Create a typed helper that documents the SDK gap and can be updated in one place:
```typescript
// src/extensions/acp/compat.ts
import type * as acp from '@agentclientprotocol/sdk';

/** SDK v0.15.0 does not include 'finish' in SessionUpdate union. */
export function createFinishUpdate(stopReason: string): acp.SessionUpdate {
  return { sessionUpdate: 'finish', stopReason } as unknown as acp.SessionUpdate;
}
```
This centralizes the cast and makes it searchable when the SDK is upgraded.

---

### 7. Arbitrary 2-second exit delay after graceful shutdown

| Field | Value |
|-------|-------|
| **File** | `src/main.ts` |
| **Line** | 436 |
| **Severity** | Minor |
| **KB Topic** | `10-implementation-guide.md` — Graceful shutdown |

**Problem:** After `shutdownManager.shutdown()` completes, a 2-second `setTimeout` delays `process.exit(0)`. The comment says "allow the event loop to drain pending I/O." However, 2 seconds is arbitrary — it may be too short for large sessions sending finish events, or unnecessarily long for simple shutdowns.

**Fix:** Consider using `setImmediate` or a shorter timeout (e.g., 100ms) since shutdown handlers already handle their own cleanup. Alternatively, call `process.exit(0)` directly after shutdown completes, since the handlers should have already drained their I/O.

---

### 8. Redundant shutdown calls from uncaught exception/rejection handlers

| Field | Value |
|-------|-------|
| **File** | `src/main.ts` |
| **Line** | 442-454 |
| **Severity** | Minor |
| **KB Topic** | `10-implementation-guide.md` — Error handling |

**Problem:** Both `uncaughtException` and `unhandledRejection` handlers unconditionally call `shutdownManager.shutdown()` and set a 5-second safety timer. If a signal-triggered shutdown is already in progress, calling `shutdown()` again is a no-op (re-entrancy guard), but the 5-second safety timer still starts and will force-exit even if the legitimate shutdown needs more time.

**Fix:** Check `shutdownManager.isShuttingDown()` before starting the safety timer:
```typescript
process.on('uncaughtException', (err) => {
  console.error('[goodvibes-acp] Uncaught exception:', err);
  if (!shutdownManager.isShuttingDown()) {
    setTimeout(() => process.exit(1), 5000).unref();
    shutdownManager.shutdown().finally(() => process.exit(1));
  }
});
```

---

### 9. `markReady()` silently ignored in non-starting states

| Field | Value |
|-------|-------|
| **File** | `src/extensions/lifecycle/health.ts` |
| **Line** | 62 |
| **Severity** | Minor |
| **KB Topic** | `10-implementation-guide.md` — Health check lifecycle |

**Problem:** `markReady()` only transitions from `starting` to `ready`. If called when the status is `shutting_down` or `degraded`, the call is silently ignored with no logging. In daemon mode, if `markReady()` is called after a shutdown begins (a race), this silent behavior makes debugging difficult.

**Fix:** Add a debug-level log when the call is ignored:
```typescript
markReady(): void {
  if (this._status === 'starting') {
    this._status = 'ready';
    this._eventBus.emit('lifecycle:health-ready', { uptime: Date.now() - this._startedAt });
  } else {
    console.error(`[HealthCheck] markReady() ignored — current status is '${this._status}'`);
  }
}
```

---

### 10. Daemon mode detection susceptible to partial CLI arg matches

| Field | Value |
|-------|-------|
| **File** | `src/main.ts` |
| **Line** | 411 |
| **Severity** | Major |
| **KB Topic** | `10-implementation-guide.md` — Section 2: Project Setup, entry point |

**Problem:** `process.argv.includes('--daemon')` matches exact strings, which is correct. However, the `getArgValue` helper (line 465-468) uses `indexOf` to find flag values, and does not validate that the next element is not another flag. For example, `--port --host 127.0.0.1` would set `port` to `--host`, which `parseInt` would turn into `NaN`. The resulting `NaN` port would cause the TCP server to bind to a random port or throw a confusing error.

**Fix:** Validate parsed values:
```typescript
const daemonPort = parseInt(
  process.env.GOODVIBES_DAEMON_PORT ?? getArgValue('--port') ?? '9000', 10,
);
if (Number.isNaN(daemonPort) || daemonPort < 1 || daemonPort > 65535) {
  console.error(`[goodvibes-acp] Invalid daemon port: ${daemonPort}`);
  process.exit(1);
}
```

---

## Category Breakdown

| Category | Score | Key Issues |
|----------|-------|------------|
| Security | 9/10 | No secrets exposure; daemon binds to localhost by default |
| Error Handling | 6/10 | PID file leak on bind failure, no arg validation, silent markReady |
| Testing | N/A | No tests in scope |
| Organization | 9/10 | Clean module boundaries, proper barrel exports |
| Performance | 8/10 | Appropriate async patterns, parallel server shutdown |
| SOLID/DRY | 7/10 | Inconsistent stop patterns between TCP and health servers |
| Naming | 9/10 | Clear, descriptive names throughout |
| Maintainability | 7/10 | Fragile type cast, hardcoded protocol version |
| Documentation | 8/10 | Good JSDoc, clear module headers |
| Dependencies | 8/10 | Minimal deps, proper layer imports |

---

## Recommendations

1. **Immediate:** Fix PID file cleanup on bind failure (#4) and health server stop race (#1)
2. **This PR:** Validate daemon CLI arguments (#10), centralize SDK type cast (#6)
3. **Follow-up:** Standardize all diagnostic output to `console.error` (#2, #5)
