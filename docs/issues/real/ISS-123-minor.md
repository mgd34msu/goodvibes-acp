# ISS-123 — session/load History Notifications Missing _goodvibes/phase: 'replay' in _meta

**Severity**: Minor
**File**: `src/extensions/acp/agent.ts:188-191`
**KB Topic**: Extensibility

## Original Issue
`session/update` notifications during `loadSession` do not include `_meta` with GoodVibes-specific data (`_goodvibes/phase: 'replay'`). *(Extensibility)*

## Verification

### Source Code Check
Lines 203-212 of `agent.ts` (the history replay loop in `loadSession`):
```typescript
for (const msg of history) {
  const updateType =
    msg.role === 'user' ? 'user_message_chunk' : 'agent_message_chunk';

  await this.conn.sessionUpdate({
    sessionId: params.sessionId,
    update: messageChunkUpdate(updateType, { type: 'text', text: msg.content }),
  });
}
```

No `_meta` field is passed on any session update during history replay. The `messageChunkUpdate` helper builds a plain update with no `_meta`.

### ACP Spec Check
KB-08 (Extensibility) defines the `_meta` pattern:
```typescript
type Meta = { [key: string]: unknown };
```
It's available on session update notification params. KB-08 explicitly shows GoodVibes using `_goodvibes/` namespaced keys for metadata, e.g.:
```json
{ "_goodvibes/phase": "apply", "_goodvibes/files": [...] }
```

KB-08 also states: "Unknown `_meta` keys MUST be ignored" — so adding it is safe. It is not strictly required by the ACP spec, but it is part of the GoodVibes extension design described in KB-08 (the `_goodvibes/` namespace is planned). Clients that understand `_goodvibes/phase: 'replay'` could use it to display history differently from live updates.

### Verdict: CONFIRMED
The issue is confirmed — no `_meta` is added during history replay. This is a real gap in the GoodVibes-specific extension implementation. While not a strict ACP wire format violation (the spec doesn't require `_meta`), it IS a gap in the stated GoodVibes extensibility design per KB-08. Accurately described.

## Remediation
1. Update `messageChunkUpdate` to accept an optional `_meta` parameter, or add `_meta` inline:
   ```typescript
   await this.conn.sessionUpdate({
     sessionId: params.sessionId,
     update: {
       ...messageChunkUpdate(updateType, { type: 'text', text: msg.content }),
       _meta: { '_goodvibes/phase': 'replay' },
     },
   });
   ```
2. Document the `_goodvibes/phase: 'replay'` semantics in KB-08 or a GoodVibes extensions reference doc.
