# ISS-114 — Basic auth does not validate colon in username per RFC 7617

**Severity**: Minor
**File**: `src/extensions/services/auth.ts`
**KB Topic**: KB-10: Security

## Original Issue
`username:password` encoding does not sanitize username for colon characters. Per RFC 7617, username MUST NOT contain a colon.

## Verification

### Source Code Check
At line 164:
```typescript
const encoded = Buffer.from(`${username}:${password}`).toString('base64');
```
No validation that `username` is free of colon characters. If the username contains a colon (e.g., `user:name`), the resulting `user:name:password` string would be ambiguously parsed by servers — they split on the first colon, so the password would be `name:password` instead of `password`.

Lines 160-162 only check that `username` and `password` are truthy, not that they conform to RFC 7617 constraints.

### ACP Spec Check
This is an RFC 7617 (HTTP Basic Authentication) compliance issue for external service auth. The ACP protocol itself does not define HTTP basic auth mechanics. KB-10 mentions security practices but does not specifically address HTTP auth header construction.

### Verdict: NOT_ACP_ISSUE
The colon-in-username issue is a valid RFC 7617 compliance concern but falls outside ACP protocol scope. This is an HTTP auth implementation detail for external service connections, not an ACP wire format or protocol requirement.
