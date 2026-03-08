# ISS-066 — `sessionInfoUpdate` Helper Uses Double `as any` Casts

**Severity**: Minor
**File**: src/extensions/acp/agent.ts:92
**KB Topic**: session_info session update (04-prompt-turn.md lines 289-315)

## Original Issue
The `sessionInfoUpdate` helper uses `as any` casts on both the discriminator and content fields. Any future SDK changes or typos will be undetected.

## Verification

### Source Code Check
Line 92 of `src/extensions/acp/agent.ts`:
```typescript
function sessionInfoUpdate(title: string): schema.SessionUpdate {
  return { sessionUpdate: 'session_info' as any, content: { type: 'text', text: title } as any } as schema.SessionUpdate;
}
```

Three `as any` casts in a single expression: one on the discriminator value, one on the content block, and one on the entire return value. This completely bypasses type checking.

### ACP Spec Check
KB-04 (lines 289-315) defines the `session_info` update:
```typescript
interface SessionInfoUpdate {
  sessionUpdate: "session_info";
  content: ContentBlock;
}
```

The structure used in the code (`sessionUpdate: 'session_info'`, `content: { type: 'text', text: title }`) is correct per the spec. The `as any` casts suggest the SDK's `SessionUpdate` type definition may not include `session_info` as a valid discriminator, requiring the cast to compile.

### Verdict: CONFIRMED
The triple `as any` cast completely suppresses type checking. While the values appear correct today, any future changes to the discriminator name, content block shape, or field names will not be caught at compile time. If the SDK type is missing `session_info`, the proper fix is to extend or augment the type, not bypass it with `as any`.

## Remediation
1. If the SDK `SessionUpdate` type is missing `session_info`, use a type augmentation or union extension rather than `as any`
2. Define a local interface that properly types the session_info update:
```typescript
interface SessionInfoUpdate {
  sessionUpdate: 'session_info';
  content: { type: 'text'; text: string };
}
```
3. Cast to this specific type instead of `any`
4. File an issue with the ACP SDK if `session_info` is missing from the `SessionUpdate` union
