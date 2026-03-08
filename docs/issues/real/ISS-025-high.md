# ISS-025: No write error handling on stdin — pending requests hang until timeout

**Source**: `src/extensions/mcp/transport.ts` (line 207)
**KB Reference**: KB-01: Transport
**Severity**: High

### Verdict: CONFIRMED

**Finding**: The `stdin.write()` call at line 207 does not handle the write callback or listen for error events on the write operation:

```typescript
this._process.stdin.write(JSON.stringify(msg) + '\n', 'utf8');
```

If the subprocess stdin pipe is broken (process crashed, pipe closed), the write silently fails. The pending Promise created for the request hangs until the 30-second timeout fires. The `_notify` method at line 218 has the same problem but is less impactful since notifications don't expect responses.

KB-01 establishes that ACP uses JSON-RPC 2.0 over stdio transport. Reliable message delivery on the transport layer is fundamental to protocol operation. A broken pipe should be detected immediately rather than waiting for timeout.

### Remediation

1. Pass an error callback to `stdin.write()` and reject the pending promise on failure:

```typescript
this._process.stdin.write(JSON.stringify(msg) + '\n', 'utf8', (err) => {
  if (err) {
    this._pending.delete(id);
    reject(new Error(`stdin write failed: ${err.message}`));
  }
});
```

2. Listen for the `'error'` event on `stdin` to reject all pending requests when the pipe breaks
