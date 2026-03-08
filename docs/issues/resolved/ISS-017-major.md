# ISS-017 — Permission Wire Format Omits Required 'permission' Object

**Severity**: Major
**File**: src/extensions/acp/permission-gate.ts:169-179
**KB Topic**: Wire Format / SDK Usage (05-permissions.md lines 25-41, 272-303)

## Original Issue
The `requestPermission` call uses `{ sessionId, options, toolCall }` but never passes the `permission` object. The `type` and `description` fields from `PermissionRequest` are never sent to the client.

## Verification

### Source Code Check
At `permission-gate.ts:169-179`:
```typescript
const response = await this.conn.requestPermission({
  sessionId: this.sessionId,
  options: buildPermissionOptions(),
  toolCall: {
    toolCallId,
    title: request.title,
    status: 'pending',
    rawInput: request._meta?.rawInput ?? null,
    ...(request._meta ? { _meta: request._meta } : {}),
  },
});
```
No `permission: { type, title, description }` object is passed.

However, the code includes a detailed comment at lines 160-166:
```
// SDK/Spec divergence (ISS-013): The ACP wire spec defines requestPermission as
// { sessionId, permission: { type, title, description } } → { granted: boolean }.
// The SDK (v0.15.0) instead uses { sessionId, options: PermissionOption[], toolCall }
// → { outcome: { outcome, optionId } }. We follow the SDK API since it's the actual
// TypeScript interface we compile against.
```

### ACP Spec Check
KB-05 (permissions.md lines 296-302) shows the SDK API:
```typescript
const { granted } = await this.conn.requestPermission({
  sessionId,
  permission: {
    type: 'shell',
    title: 'Run shell command',
    description: command,
  },
});
```

The wire spec expects `permission: { type, title, description }`. The KB documents this as the canonical format.

### Verdict: PARTIAL
The issue correctly identifies that the `permission` object is missing from the `requestPermission` call. However, the code documents a known SDK/spec divergence — the actual TypeScript SDK (v0.15.0) apparently uses a different API shape (`options`/`toolCall`) than the wire spec (`permission`). The code follows the SDK's TypeScript interface to compile successfully. The real fix depends on SDK version alignment with the wire spec.

## Remediation
1. When the SDK aligns with the wire spec, update the call to pass `permission: { type: request.type, title: request.title, description: request.description }`
2. In the interim, verify that the current SDK API actually matches what the code uses — if the SDK has been updated since v0.15.0, this code may need updating
3. Consider adding a compatibility layer that works with both the SDK and wire spec formats
4. Track the SDK/spec divergence as a dependency for full ACP compliance
