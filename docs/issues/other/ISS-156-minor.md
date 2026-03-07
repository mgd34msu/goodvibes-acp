# ISS-156 — Unsafe Type Cast After JSON.parse Without Runtime Validation

**Severity**: Minor
**File**: `src/plugins/analytics/sync.ts:48`
**KB Topic**: Extensibility

## Original Issue
`JSON.parse(raw) as SessionAnalytics` — unsafe cast with no runtime validation.

## Verification

### Source Code Check
Line 48 of `src/plugins/analytics/sync.ts`:
```typescript
const session = JSON.parse(raw) as SessionAnalytics;
```

Context (lines 44-57):
```typescript
async load(sessionId: string): Promise<SessionAnalytics | null> {
  const filePath = this._sessionPath(sessionId);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const session = JSON.parse(raw) as SessionAnalytics;
    this._store.sessions.set(sessionId, session);
    return session;
  } catch (err: unknown) {
    // File not found or unreadable
    if (isNodeError(err) && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}
```

The TypeScript `as` cast is a compile-time assertion only — it performs no runtime validation. If the disk file contains malformed or outdated data (e.g., missing required fields), the returned object will silently violate the `SessionAnalytics` type contract.

### ACP Spec Check
The ACP spec does not define `SessionAnalytics` or analytics persistence formats. This is an internal plugin data type with no ACP wire format equivalent. There is no ACP compliance requirement for runtime type validation of internal analytics data.

### Verdict: NOT_ACP_ISSUE
The issue is real — the unsafe cast can cause subtle runtime failures if persisted data is malformed or migrated. However, this is a TypeScript type safety issue in internal plugin storage, not an ACP protocol compliance violation.

## Remediation
N/A for ACP compliance. As a code quality fix, add runtime validation:
```typescript
const parsed: unknown = JSON.parse(raw);
if (!isSessionAnalytics(parsed)) {
  throw new Error(`Invalid SessionAnalytics data in ${filePath}`);
}
const session = parsed;
```
