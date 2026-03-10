# ISS-019: `session/load` does not update session `cwd` on resume

**Severity**: Major  
**File**: `src/extensions/sessions/manager.ts`  
**Lines**: 124-136  
**KB Reference**: KB-03 (Sessions)

## Description

`SessionManager.load()` retrieves stored context but provides no mechanism to update `cwd` with the `session/load` request value.

## Evidence

`SessionManager.load()` (lines 124-136):
```typescript
async load(sessionId: string): Promise<{ context: SessionContext; history: HistoryMessage[] }> {
  const stored = this._store.get<StoredContext>(NS, sessionId);
  if (!stored) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  const history = this._store.get<HistoryMessage[]>(NS, `${HISTORY_PREFIX}${sessionId}`) ?? [];
  const context: SessionContext = { ...stored, history };
  this._bus.emit('session:loaded', { sessionId });
  return { context, history };
}
```

The method accepts only `sessionId` and returns stored context as-is. It has no parameter for `cwd` or `mcpServers` from the `LoadSessionRequest`.

The SDK `LoadSessionRequest` requires:
```typescript
export type LoadSessionRequest = {
  cwd: string;          // REQUIRED
  mcpServers: Array<McpServer>;  // REQUIRED
  sessionId: SessionId;
};
```

KB-03 states: "Agent MUST use this as the session's working directory."

### Verdict: CONFIRMED

The load method ignores the incoming `cwd` and `mcpServers` from the request, using only stored values. This violates KB-03's requirement that the agent use the provided `cwd`.

## Remediation

1. Add `cwd` and `mcpServers` parameters to `SessionManager.load()`.
2. Update the stored session context's `config.cwd` and `config.mcpServers` with the request values.
3. Persist the updated context back to the store.
