# ISS-153: `_fetchWithTimeout` does not consume response body

**Source**: `src/extensions/services/health.ts` line 217
**KB Reference**: KB-10 (Resource Management)
**Severity**: Minor

## Issue Description
`_fetchWithTimeout` returns the raw `Response` without draining the body. For HTTP responses with large bodies (especially GET fallback paths), the unconsumed body stream can cause connection leaks in Node.js.

### Verdict: CONFIRMED

The code at lines 213-221 returns `await fetch(url, { method, signal: controller.signal })` directly. The caller (health check logic) likely only inspects `response.status` and never reads the body. In Node.js, unconsumed response bodies prevent the underlying TCP connection from being released back to the pool, causing connection leaks under sustained health check polling.

## Remediation
1. After obtaining the response status, drain the body: `response.body?.cancel()` or `await response.text()`
2. Alternatively, if only the status is needed, consider using `HEAD` requests exclusively to avoid body overhead
3. If the method must remain configurable, drain the body in the caller after extracting the status code
