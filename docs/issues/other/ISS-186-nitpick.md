# ISS-186 — IPC Router Parameter Named `type` Shadows Message Field Concept

**Severity**: Nitpick
**File**: `src/extensions/ipc/router.ts:66`
**KB Topic**: TypeScript SDK

## Original Issue
`[src/extensions/ipc/router.ts:66]` Parameter named `type` shadows message `type` field concept. Rename to `methodName`. *(TypeScript SDK)*

## Verification

### Source Code Check
Lines 55–68 of `src/extensions/ipc/router.ts`:
```typescript
/**
 * Register a handler for a named IPC method.
 *
 * If a handler is already registered for the given `type`, it is replaced.
 *
 * @param type    The method name (e.g. 'ping', 'status')
 * @param handler Function that receives the full IpcRequest and returns
 *                a response payload (sync or async).
 */
register(type: string, handler: IpcHandler): void {
  this._handlers.set(type, handler);
}
```
The parameter `type` on line 66 is used for IPC method name routing. The `IpcRequest` type likely also has a `type` or `method` field. The naming creates conceptual ambiguity — a reader might confuse the parameter with the message's own `type` discriminant.

### ACP Spec Check
The ACP specification and all 10 KB files make no mention of IPC routers, internal IPC message routing, or naming conventions for internal routing parameters. The `IpcRouter` is an internal infrastructure component, not an ACP protocol artifact. ACP uses JSON-RPC 2.0 `method` field names, not `type`, for routing — but this router is not the ACP JSON-RPC layer.

### Verdict: NOT_ACP_ISSUE
The issue describes a naming clarity concern (`type` vs `methodName`) in an internal IPC routing component that has no ACP wire protocol role. The KB topic annotation of "TypeScript SDK" is a mislabeling — this code does not implement any ACP SDK interface. The rename suggestion is reasonable code style, but it is not an ACP compliance issue.

## Remediation
N/A — not an ACP compliance issue.

For code clarity: rename the parameter from `type` to `method` or `methodName` in `register(type: string, handler: IpcHandler)` and update the JSDoc accordingly.
