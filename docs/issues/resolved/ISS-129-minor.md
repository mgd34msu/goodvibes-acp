# ISS-129 — session_info_update Discriminant Uncertainty Noted in Comment but Unresolved

**Severity**: Minor
**File**: `src/extensions/acp/agent.ts:63-64`
**KB Topic**: TypeScript SDK

## Original Issue
`session_info_update` discriminant uncertainty noted in comment but unresolved. Verify exact discriminant against SDK's `SessionUpdate` type definition. *(TypeScript SDK)*

## Verification

### Source Code Check
Lines 58-65:
```typescript
/**
 * Build a typed session_info_update SessionUpdate.
 * NOTE: The literal used here is 'session_info_update'. ACP doc-04 references 'session_info'
 * — if the SDK is updated to use that name, this cast will need updating.
 */
function sessionInfoUpdate(title: string, updatedAt: string): schema.SessionUpdate {
  return { sessionUpdate: 'session_info_update' as const, title, updatedAt };
}
```

The code uses `'session_info_update'` as the discriminant value, with a comment acknowledging it may need to be `'session_info'`. The return type is `schema.SessionUpdate` (no explicit `as any` cast, so the SDK types appear to accept this value — or the cast is implicit).

### ACP Spec Check
KB-04 (Prompt Turn) defines the `session_info` update:
```typescript
interface SessionInfoUpdate {
  sessionUpdate: "session_info";
  content: ContentBlock;
}
```

KB-04's update type reference table at line 554:
```
| session_info | Agent → Client | General informational messages |
```

The correct discriminant is unambiguously `'session_info'` per the ACP spec. This is also identified as a Critical issue (ISS-006) which notes the wrong discriminant AND wrong payload shape: spec requires `{ sessionUpdate: 'session_info', content: { type: 'text', text: title } }` while the code sends `{ sessionUpdate: 'session_info_update', title, updatedAt }`.

Additionally the payload shape is wrong — spec uses a `content: ContentBlock` field, not separate `title`/`updatedAt` fields.

### Verdict: CONFIRMED
The issue is confirmed. The discriminant `'session_info_update'` is wrong; the spec says `'session_info'`. The payload shape is also wrong (wrong fields). The comment in the code acknowledges the uncertainty without resolving it. The correct fix requires both the discriminant AND the payload shape to change. Note this overlaps with ISS-006 (Critical); ISS-129 is the minor aspect of the same root problem (unresolved comment).

## Remediation
1. Change the discriminant from `'session_info_update'` to `'session_info'`.
2. Change the payload to use `content: ContentBlock` instead of `title`/`updatedAt`:
   ```typescript
   function sessionInfoUpdate(title: string): schema.SessionUpdate {
     return {
       sessionUpdate: 'session_info',
       content: { type: 'text', text: title },
     };
   }
   ```
3. Remove the `updatedAt` parameter (not part of the `session_info` spec shape).
4. Update all callers of `sessionInfoUpdate()` to pass only `title`.
5. See also ISS-006 for the full Critical-level remediation of this issue.
