# ISS-061: ServiceHealthChecker is dead code

**Severity**: Major
**File**: src/extensions/services/health.ts
**Line(s)**: 1-240 (whole file)
**Topic**: Initialization

## Issue Description
`ServiceHealthChecker` is exported but never imported outside its own module. Checks external HTTP services, not ACP connection health.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/02-initialization.md
- **Spec Says**: ACP defines no concept of external service health checking. Initialization handles protocol version negotiation and capability exchange.
- **Confirmed**: Yes
- **Notes**: The class checks HTTP service endpoints (HEAD/GET probes). This is unrelated to ACP protocol health. ACP has no built-in health check mechanism.

### Source Code Check
- **Code Exists**: Yes (240 lines)
- **Code Shows**: `ServiceHealthChecker` class with `check()` and `checkAll()` methods, probing HTTP endpoints via `fetch`. Only import is from its sibling `./registry.js`. Grep for `services/health` across `src/**/*.ts` returns only the file itself — zero external consumers.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Either integrate `ServiceHealthChecker` into the application startup or ACP lifecycle (e.g., health endpoint for monitoring)
2. Or remove the file entirely to reduce dead code
3. If kept, wire it into an ACP extension method (e.g., `_goodvibes/health`) so clients can query service status
