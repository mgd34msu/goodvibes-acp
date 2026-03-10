# ISS-036: Webhook responses use plain-text instead of JSON-RPC 2.0

**Severity**: Major
**Category**: KB-08 Extensibility
**File**: `src/extensions/external/http-listener.ts`
**Lines**: 118-129, 301-303

## Description

The `reply()` helper sends `Content-Type: text/plain; charset=utf-8` for all HTTP responses including success (200 "OK"), errors (400, 401, 413), and the final webhook acknowledgment. The issue claims this violates ACP JSON-RPC 2.0 envelope requirements.

### Verdict: PARTIAL

The `reply()` function does use `text/plain` as confirmed in source. However, this is an internal webhook ingestion endpoint — it receives events from external services (GitHub, Slack, etc.) via HTTP, not from ACP clients via JSON-RPC 2.0. The webhook HTTP responses are acknowledgments to external webhook senders, not ACP protocol messages. External services expect simple HTTP status codes, not JSON-RPC 2.0 envelopes.

That said, the 200 "OK" response could carry a structured JSON body for better diagnostics, and error responses would benefit from structured error information. This is a quality improvement, not an ACP compliance issue.

## Remediation

1. Consider returning JSON responses with `Content-Type: application/json` for consistency.
2. Error responses could include structured error details: `{ error: 'Bad Request: invalid JSON' }`.
3. Do NOT wrap in JSON-RPC 2.0 envelopes — these are HTTP webhook endpoints, not ACP transport.

## ACP Reference

KB-08: Extensibility methods use JSON-RPC 2.0, but this applies to ACP client-agent communication, not external webhook ingestion.
