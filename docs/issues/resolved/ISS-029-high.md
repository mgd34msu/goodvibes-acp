# ISS-029: Unbounded buffer accumulation in IPC socket — no size limit on state.buffer

**Source**: `src/extensions/ipc/socket.ts` (line 187)
**KB Reference**: KB-01: Security
**Severity**: High

### Verdict: CONFIRMED

**Finding**: The `_handleData` method appends incoming chunks to `state.buffer` with string concatenation (`state.buffer += chunk`) without any size limit. The buffer only shrinks when complete NDJSON lines (terminated by `\n`) are found and consumed.

A malicious or malfunctioning client can:
- Send a continuous stream of data without newlines, growing the buffer indefinitely
- Send data faster than it can be processed, accumulating unbounded backpressure

This leads to unbounded memory consumption until the process crashes with an out-of-memory error.

While the IPC socket is an internal component, KB-01 establishes security expectations for transport layers. The ACP implementation guide (KB-10) emphasizes graceful handling of edge cases. An agent that can be crashed by a malformed input stream has a security vulnerability.

### Remediation

1. Add a maximum buffer size constant (e.g., 1MB):

```typescript
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

private _handleData(state: ConnectionState, chunk: string): void {
  state.buffer += chunk;
  if (state.buffer.length > MAX_BUFFER_SIZE) {
    state.socket.destroy(new Error('Buffer overflow: message exceeds maximum size'));
    return;
  }
  // ... existing newline processing
}
```

2. Emit an `ipc:disconnected` event with an error reason when destroying the connection
