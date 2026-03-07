# ISS-132 — `setEncoding('utf-8')` Silently Replaces Malformed UTF-8

**Severity**: Minor
**File**: src/extensions/ipc/socket.ts
**KB Topic**: TypeScript SDK

## Original Issue
`setEncoding('utf-8')` forces all data through string decoding. Malformed UTF-8 silently replaced.

## Verification

### Source Code Check
At line 150 of `src/extensions/ipc/socket.ts`:
```typescript
socket.setEncoding('utf-8');
```
This is called in `_handleConnection()` and causes the `'data'` event at line 152 to deliver `string` instead of `Buffer`:
```typescript
socket.on('data', (chunk: string) => {
  this._handleData(state, chunk);
});
```
Node.js's `socket.setEncoding()` uses the `StringDecoder` under the hood, which replaces malformed byte sequences with the Unicode replacement character (U+FFFD) without throwing or signaling errors. Malformed UTF-8 in IPC messages would silently produce corrupt JSON that then fails to parse.

### ACP Spec Check
The ACP spec (via KB `01-overview.md`) requires JSON-RPC 2.0 message framing over NDJSON. The spec does not address UTF-8 error handling directly, but any silent data corruption undermines protocol correctness. This is a robustness issue rather than a pure ACP compliance issue.

### Verdict: NOT_ACP_ISSUE
The code has the described behavior — `setEncoding('utf-8')` does silently replace malformed UTF-8. However, this is an internal IPC transport (Unix domain socket, not ACP wire protocol), and malformed UTF-8 in practice signals a bug at the sender, not an ACP compliance gap. This is a code quality/robustness issue, not an ACP compliance issue.

## Remediation
1. Remove `socket.setEncoding('utf-8')` and handle raw `Buffer` chunks.
2. In `_handleData`, accumulate `Buffer` chunks and decode with `TextDecoder` using `{ fatal: true }` to throw on malformed input.
3. Catch decode errors in `_processLine` and respond with a parse error response.
```typescript
// Replace setEncoding with manual decode
const decoder = new TextDecoder('utf-8', { fatal: true });
socket.on('data', (chunk: Buffer) => {
  try {
    const str = decoder.decode(chunk, { stream: true });
    this._handleData(state, str);
  } catch {
    socket.destroy(new Error('Malformed UTF-8 in IPC stream'));
  }
});
```
