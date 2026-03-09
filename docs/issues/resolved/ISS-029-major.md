# ISS-029 — No buffer size limit on IPC socket connections

**Severity**: Major
**File**: `src/extensions/ipc/socket.ts`
**Lines**: 186-198
**KB Reference**: KB-10 (Implementation)

## Description

The `_handleData` method appends incoming data to a string buffer without any size limit:

```typescript
private _handleData(state: ConnectionState, chunk: string): void {
  state.buffer += chunk;
  // Process complete NDJSON lines...
}
```

A malicious or buggy client can send data without newline delimiters, causing unbounded memory growth. This is a denial-of-service vector — a single connection can exhaust the agent's memory.

### Verdict: CONFIRMED

The source at line 187 shows `state.buffer += chunk` with no size guard. The `ConnectionState` type (line 36) defines `buffer: string` with no max length. KB-10 implementation guidance requires defensive handling of untrusted input.

## Remediation

1. Define a maximum buffer size constant (e.g., `MAX_BUFFER_SIZE = 1024 * 1024` — 1MB)
2. Check buffer length before appending: if `state.buffer.length + chunk.length > MAX_BUFFER_SIZE`, emit an error and close the connection
3. Log the overflow event for debugging
4. Consider making the limit configurable via `IpcSocketOptions`
