# Wave 2 Review — Agent 5: Services & Health

**Scope**: `src/extensions/services/registry.ts`, `src/extensions/services/auth.ts`, `src/extensions/services/health.ts`  
**KB References**: `05-permissions.md`, `07-filesystem-terminal.md`, `08-extensibility.md`, `10-implementation-guide.md`  
**Reviewer**: ACP Compliance Review Agent (Iteration 4, Phase 2)

---

## Issues

### ISS-W2-501 — Credentials written to disk without restrictive file permissions
**File**: `src/extensions/services/registry.ts` L175  
**KB**: `07-filesystem-terminal.md` (fs write security), `05-permissions.md` (permission gating)  
**Severity**: HIGH  

`writeFile(filePath, ..., 'utf-8')` does not set `mode: 0o600`. The `services.json` file containing bearer tokens, passwords, and API keys is created with the default umask (typically 0o644), making it world-readable. The security warning comment at L163-170 acknowledges this but no mitigation is implemented.

**Fix**: Pass `{ mode: 0o600 }` as a write option, or use a two-step write (`writeFile` with restrictive mode + `chmod` fallback).

---

### ISS-W2-502 — Credentials leaked via EventBus on service:registered
**File**: `src/extensions/services/registry.ts` L209  
**KB**: `08-extensibility.md` (extension events), `05-permissions.md` (sensitive data)  
**Severity**: HIGH  

`this._bus.emit('service:registered', { name, config })` emits the full `ServiceConfig` including nested `ServiceAuth` (bearer tokens, passwords, API keys). Any EventBus subscriber — including logging, analytics, or ACP extension notification forwarding — receives plaintext credentials.

**Fix**: Emit a redacted config: `{ name, endpoint: config.endpoint, authType: config.auth?.type }`. Never include credential values in events.

---

### ISS-W2-503 — No atomic write for services.json persistence
**File**: `src/extensions/services/registry.ts` L174-176  
**KB**: `10-implementation-guide.md` (data persistence)  
**Severity**: MEDIUM  

`save()` writes directly to `services.json`. A crash or power loss during the write results in a truncated/corrupted file. The `load()` method will then throw on invalid JSON, losing all service registrations.

**Fix**: Write to a temporary file (`services.json.tmp`) then rename atomically: `writeFile(tmpPath, ...) → rename(tmpPath, filePath)`.

---

### ISS-W2-504 — Health probe response bodies not consumed
**File**: `src/extensions/services/health.ts` L186-194  
**KB**: `10-implementation-guide.md` (resource management)  
**Severity**: MEDIUM  

`_fetchWithTimeout` returns a `Response` object, but neither `_probe` nor `_statusFromResponse` consumes or drains the response body. In Node.js/Bun, unconsumed response bodies can cause socket/memory leaks, especially under repeated health checks with retry.

**Fix**: After extracting the status code, explicitly drain the body: `await response.body?.cancel()` or `await response.text()`.

---

### ISS-W2-505 — Health probes do not send authentication headers
**File**: `src/extensions/services/health.ts` L186, L190, L209-221  
**KB**: `08-extensibility.md` (service integration)  
**Severity**: MEDIUM  

`_fetchWithTimeout` sends bare HEAD/GET requests with no auth headers. Services configured with `ServiceAuth` (bearer, basic, api-key) will receive unauthenticated probes, resulting in 401/403 responses classified as "degraded" rather than reflecting actual health. The `ServiceAuthOrchestrator` exists but is not used by health checks.

**Fix**: Accept optional auth headers in `_fetchWithTimeout` and resolve them via `ServiceAuthOrchestrator.authenticate()` before probing.

---

### ISS-W2-506 — ServiceAuthOrchestrator not wired to ACP extension methods
**File**: `src/extensions/services/auth.ts` L55-63  
**KB**: `08-extensibility.md` (extension methods — `_`-prefixed)  
**Severity**: MEDIUM  

The class is fully implemented but has no ACP integration (ISS-039). Per KB-08, custom extension methods (`_goodvibes/auth`) should be registered to expose this functionality. Without wiring, no ACP client can invoke service authentication, and the code is effectively dead.

**Fix**: Register a `_goodvibes/auth` extension method handler in the ACP agent that delegates to `ServiceAuthOrchestrator.authenticate()`.

---

### ISS-W2-507 — ServiceHealthChecker not wired to ACP extension methods
**File**: `src/extensions/services/health.ts` L57-66  
**KB**: `08-extensibility.md` (extension methods — `_`-prefixed)  
**Severity**: MEDIUM  

Same as ISS-W2-506 but for health checking (ISS-040). The suggested `_goodvibes/health` extension method is documented in the class comment but not implemented. Runtime health status is invisible to ACP clients.

**Fix**: Register a `_goodvibes/health` extension method handler that returns `checker.checkAll()` results.

---

### ISS-W2-508 — Basic auth username not validated for colon characters
**File**: `src/extensions/services/auth.ts` L160-164  
**KB**: `10-implementation-guide.md` (input validation)  
**Severity**: LOW  

RFC 7617 Section 2 specifies that the user-id in Basic auth MUST NOT contain a colon. `Buffer.from(\`${username}:${password}\`)` will produce an ambiguous credential string if `username` contains `:`, potentially causing auth failures or security issues at the target service.

**Fix**: Validate that `username` does not contain `:` before constructing the Basic auth header.

---

### ISS-W2-509 — Invalid entry warnings use console.warn instead of EventBus
**File**: `src/extensions/services/registry.ts` L136-139  
**KB**: `08-extensibility.md` (observability via events)  
**Severity**: LOW  

When `_validateEntry` rejects a corrupted entry during `load()`, the warning is sent to `console.warn`. This bypasses the EventBus-based observability pattern used everywhere else in the module (L155, L176, L209, L241). In a headless ACP runtime, console output may be captured as agent stdout and corrupt the ndjson transport.

**Fix**: Emit a `service:load-warning` event via `this._bus.emit()` instead of `console.warn()`.

---

### ISS-W2-510 — Health check retry uses fixed delay without backoff
**File**: `src/extensions/services/health.ts` L179-198  
**KB**: `10-implementation-guide.md` (retry patterns)  
**Severity**: LOW  

The retry loop uses a fixed `retryDelayMs` between attempts. When checking multiple services via `checkAll()` with retries, a degraded service receives probes at a constant rate. Exponential or jittered backoff would reduce load on struggling services and improve recovery characteristics.

**Fix**: Apply exponential backoff: `delay * Math.pow(2, attempt - 1)` with optional jitter.

---

## Summary

| ID | Severity | File | Issue |
|----|----------|------|-------|
| W2-501 | HIGH | registry.ts:175 | No restrictive file permissions on credentials file |
| W2-502 | HIGH | registry.ts:209 | Credentials leaked via EventBus events |
| W2-503 | MEDIUM | registry.ts:174-176 | Non-atomic write risks corruption |
| W2-504 | MEDIUM | health.ts:186-194 | Response bodies not consumed (resource leak) |
| W2-505 | MEDIUM | health.ts:186 | Health probes sent without auth headers |
| W2-506 | MEDIUM | auth.ts:55-63 | Auth orchestrator not wired to ACP |
| W2-507 | MEDIUM | health.ts:57-66 | Health checker not wired to ACP |
| W2-508 | LOW | auth.ts:160-164 | Basic auth username colon not validated |
| W2-509 | LOW | registry.ts:136-139 | console.warn bypasses EventBus |
| W2-510 | LOW | health.ts:179-198 | Fixed retry delay, no backoff |

**HIGH**: 2 | **MEDIUM**: 5 | **LOW**: 3

## Overall Score: 5.5 / 10

The service layer has solid structural foundations — good type definitions, proper validation on load (ISS-113 fix), URL validation on register, and exhaustive auth type handling. However, two HIGH-severity credential exposure issues (disk permissions and event leakage) represent real security risks. The lack of ACP integration for both auth and health means these modules are currently dead code from the protocol perspective. The health checker has resource management gaps (unconsumed response bodies) and doesn't leverage the auth system it sits alongside. The code quality is good but the security and integration posture needs significant improvement before production use.
