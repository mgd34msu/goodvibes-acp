# Wave 2 — Agent 5: Services & Health Review

**Reviewer**: goodvibes:reviewer (Iteration 3)  
**Scope**: `src/extensions/services/auth.ts`, `src/extensions/services/health.ts`, `src/extensions/services/index.ts`, `src/extensions/services/registry.ts`  
**KB References**: `08-extensibility.md`, `10-implementation-guide.md`  
**ACP Spec Source**: `https://agentclientprotocol.com/llms-full.txt`

---

## Summary

The services module provides a ServiceRegistry (with JSON persistence), a ServiceAuthOrchestrator (bearer/basic/api-key), and a ServiceHealthChecker (HTTP HEAD/GET probes). The ServiceRegistry is instantiated and used in main.ts. The auth and health classes are fully implemented but explicitly not integrated with any ACP extension method handler, documented via ISS-039 and ISS-040 status comments. Code quality is high with proper error handling, input validation, and clear documentation. The primary concerns are around plaintext credential storage (documented but unmitigated) and the non-integration of auth/health with the ACP extension method dispatch.

---

## Issues

| # | File | Line | KB Topic | Severity | Description |
|---|------|------|----------|----------|-------------|
| 1 | `src/extensions/services/registry.ts` | 164 | 10-implementation-guide (Security) | Major | `save()` writes credentials as plaintext JSON without setting restrictive file permissions (chmod 600). The ISS-042 comment documents the need but does not implement it. `writeFile` is called without `{ mode: 0o600 }`, leaving credentials world-readable by default. |
| 2 | `src/extensions/services/auth.ts` | 55-66 | 08-extensibility (Extension Methods) | Minor | `ServiceAuthOrchestrator` is not wired to any `_goodvibes/auth` extension method handler. The class documents an integration path (ISS-039) but no corresponding case exists in `src/extensions/acp/extensions.ts`. Per KB 10 Section 10, extension methods should be registered in the `extMethod` switch. This is documented as future work but represents incomplete integration. |
| 3 | `src/extensions/services/health.ts` | 57-66 | 08-extensibility (Extension Methods) | Minor | `ServiceHealthChecker` is not wired to any `_goodvibes/health` extension method. The class documents an integration path (ISS-040) but `extensions.ts` uses a different `HealthCheck` class from `lifecycle/health.ts` for the `_goodvibes/state` response. The service-level health checking is entirely disconnected from the ACP layer. |
| 4 | `src/extensions/services/registry.ts` | 131 | 10-implementation-guide (Validation) | Minor | `load()` validates the store structure (object shape, `services` is array) but does not validate individual `ServiceEntry` fields. A corrupted entry with missing `name` or `endpoint` would be loaded into memory and could cause runtime errors when `register()` or `check()` methods access those fields. |
| 5 | `src/extensions/services/registry.ts` | 198 | 08-extensibility (Event Payloads) | Nitpick | `register()` emits `service:registered` with the full `config` object, which may include auth credentials (tokens, passwords, API keys). Event listeners (including potential ACP extension method forwarding via `_goodvibes/events`) could inadvertently log or transmit these credentials. Consider emitting a redacted config. |
| 6 | `src/extensions/services/health.ts` | 217 | 10-implementation-guide (Error Handling) | Nitpick | `_fetchWithTimeout` does not consume or discard the response body. For HTTP responses with large bodies (especially the GET fallback on 405), this could cause memory pressure or connection leaks. Consider calling `response.body?.cancel()` or `response.text()` to drain the stream. |
| 7 | `src/extensions/services/auth.ts` | 164 | 10-implementation-guide (Security) | Minor | Basic auth encodes `username:password` with `Buffer.from().toString('base64')` which is correct, but the credential values are not sanitized for colon characters in the username. Per RFC 7617, the username MUST NOT contain a colon. No validation is performed. |

---

## Reality Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Files exist | PASS | All 4 files exist on disk |
| Exports used | WARN | `ServiceRegistry` used in main.ts. `ServiceAuthOrchestrator` and `ServiceHealthChecker` are exported but never instantiated outside their own module (0 external usages). Documented as ISS-039/ISS-040. |
| Import chain valid | PASS | `index.ts` barrel re-exports all three modules. `main.ts` imports `ServiceRegistry` directly. |
| No placeholders | PASS | No TODO/FIXME/placeholder stubs. ISS comments are status markers, not placeholders. |
| Integration verified | WARN | ServiceRegistry is integrated. Auth and Health classes are implemented but not wired to ACP extension methods or any runtime path. |

---

## Positive Observations

- Exhaustive switch with `never` guard in auth.ts line 187 prevents unhandled auth types at compile time
- Proper AbortController-based timeout in health.ts with cleanup in finally block
- HEAD-to-GET fallback on 405 is a robust health check pattern
- Runtime validation in registry.ts `load()` guards against corrupted JSON files (ISS-041)
- Clear ISS-numbered status comments explain why classes are not yet integrated, with specific integration instructions
- Clean layer boundaries: L2 imports only from L0/L1 as required by architecture

---

## Score: 7.8/10

| Category | Score | Notes |
|----------|-------|-------|
| Security | 6/10 | Plaintext credential persistence without file permissions; credentials in event payloads |
| Error Handling | 8/10 | Good try/catch patterns, proper error propagation, runtime validation on load |
| Testing | N/A | No test files in scope |
| Organization | 9/10 | Clean barrel export, clear module boundaries, proper L2 layering |
| Performance | 8/10 | Parallel health checks via Promise.all; minor concern with undrained response bodies |
| SOLID/DRY | 8/10 | Good separation of concerns; auth/health/registry each have single responsibility |
| Naming | 9/10 | Clear, descriptive names throughout |
| Maintainability | 8/10 | Well-documented with JSDoc; ISS references enable tracking |
| Documentation | 9/10 | Comprehensive JSDoc, integration instructions, security warnings |
| Dependencies | 8/10 | Minimal dependencies; clean imports from L0/L1 only |
