# ISS-081 — readTextFile passes line/limit but SDK type may not support them

**Severity**: Minor
**File**: `src/extensions/acp/fs-bridge.ts`
**Lines**: 56–61
**KB Reference**: KB-09 (TypeScript SDK — Filesystem)

## Issue

The `FsBridge.readTextFile()` method passes `line` and `limit` fields in the `ReadTextFileRequest` object sent to the ACP client:

```typescript
const response = await this.conn.readTextFile({
  path,
  sessionId: this.sessionId,
  line: options?.line,
  limit: options?.limit,
});
```

However, the ACP SDK defines `ReadTextFileRequest` as `{ sessionId: string, path: string }` with no `line` or `limit` fields (KB-09 line 179). The extra fields will be silently ignored by compliant clients, meaning the agent receives the full file content and never applies the requested slicing.

### Verdict: CONFIRMED

The SDK type explicitly defines only `sessionId` and `path`. Passing additional fields violates the type contract and the line/limit filtering is silently lost when using the ACP bridge path.

## Remediation

1. Remove `line` and `limit` from the `readTextFile` call to the ACP client connection.
2. Apply line/limit slicing to the response content (same logic already exists in the disk fallback path at lines 72–76).
3. Extract the slicing logic into a shared helper used by both the ACP bridge and disk fallback paths.
