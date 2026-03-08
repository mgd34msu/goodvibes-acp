# ISS-117 — `SessionSync.load` deserializes untrusted JSON without validation

**Severity**: Minor
**File**: `src/plugins/analytics/sync.ts`
**KB Topic**: KB-08: Forward Compatibility

## Original Issue
`JSON.parse(raw) as SessionAnalytics` with no runtime validation. Corrupted data silently produces invalid objects.

## Verification

### Source Code Check
At lines 47-53:
```typescript
const raw = await readFile(filePath, 'utf-8');
// NOTE: JSON.parse result is cast to SessionAnalytics without runtime validation.
const session = JSON.parse(raw) as SessionAnalytics;
this._store.sessions.set(sessionId, session);
return session;
```
The code acknowledges the issue in a comment (lines 48-50) but does not implement validation. The parsed object is directly inserted into the in-memory store. If the JSON file has:
- Missing `sessionId` field — downstream code accessing `session.sessionId` gets `undefined`
- Wrong type for `entries` (e.g., not an array) — `entries.push()` would throw
- Extra/renamed fields from a different schema version — silently accepted

### ACP Spec Check
KB-08 discusses forward compatibility: unknown `_meta` keys and extension methods MUST be handled gracefully. While this guidance is about protocol-level messages, the principle extends to persisted data — implementations should be resilient to schema evolution. This is a defensive coding concern aligned with KB-08's forward compatibility guidance.

### Verdict: PARTIAL
The issue is real — JSON is deserialized without runtime validation. However, the code explicitly documents this limitation in comments (lines 48-50). The risk is confined to corrupted local files, not incoming ACP protocol messages. It's a code quality issue tangentially related to KB-08's forward compatibility guidance.

## Remediation
1. Add a `validateSessionAnalytics(data: unknown): SessionAnalytics` function that checks required fields: `sessionId` (string), `startedAt` (number), `entries` (array), `totalTokensIn`/`totalTokensOut` (numbers).
2. Wrap the `JSON.parse` result in this validator before inserting into the store.
3. On validation failure, log a warning and return `null` instead of inserting corrupted data.
