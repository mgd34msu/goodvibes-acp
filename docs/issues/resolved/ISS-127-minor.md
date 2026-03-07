# ISS-127 — 'finish' Session Update Uses 'as any' Cast in agent.ts

**Severity**: Minor
**File**: `src/extensions/acp/agent.ts:270, 298, 306, 320`
**KB Topic**: TypeScript SDK

## Original Issue
`finish` session update uses `as any` cast. Fix underlying type mismatch; remove cast. *(TypeScript SDK)*

## Verification

### Source Code Check
Four occurrences of `as any` on `finish` session updates:

Line 290:
```typescript
update: { sessionUpdate: 'finish', stopReason: 'cancelled' } as any,
```

Line 318:
```typescript
update: { sessionUpdate: 'finish', stopReason: 'end_turn' } as any,
```

Line 326 (error catch branch):
```typescript
update: { sessionUpdate: 'finish', stopReason: 'cancelled' } as any,
```

Line 340:
```typescript
update: { sessionUpdate: 'finish', stopReason: 'end_turn' } as any,
```

The `as any` casts are needed because the SDK's `SessionUpdate` union type does not include a `'finish'` discriminant in its TypeScript types — yet the SDK documentation (KB-09 lines 131-134) shows a `finish` update shape:
```typescript
{
  sessionUpdate: "finish",
  stopReason: string
}
```

### ACP Spec Check
KB-09 (TypeScript SDK) explicitly shows `sessionUpdate: "finish"` as a valid update type in the `sessionUpdate` method documentation. The comment in the code (line 60-61) even acknowledges this uncertainty about the discriminant. The `finish` update is used to signal the end of a turn to the client. However, KB-04 (Prompt Turn) does NOT define a `finish` sessionUpdate in its update type reference table — the turn ends via the `session/prompt` response `stopReason`, not via a session update.

The `as any` casts exist because `SessionUpdate` in the SDK TypeScript types does not include `'finish'`, yet the code sends it. This is a type system gap — either the SDK types are incomplete, or `finish` is not a real ACP update type and the code is sending an unsupported update.

### Verdict: CONFIRMED
The issue is confirmed — four `as any` casts exist. The root cause is a type mismatch: either the SDK types are missing the `finish` variant (type gap to fix), or `finish` is not a valid ACP update and these emissions should be removed (per KB-04 which lists no `finish` update type). This is a real TypeScript type safety issue. See also ISS-103 which flags `finish` as not defined in spec.

## Remediation
Option A (if `finish` is a valid but untyped SDK update):
1. Declare a local type extension:
   ```typescript
   type FinishUpdate = { sessionUpdate: 'finish'; stopReason: string };
   type ExtendedSessionUpdate = schema.SessionUpdate | FinishUpdate;
   ```
2. Replace `as any` with `as ExtendedSessionUpdate`.

Option B (if `finish` is not a valid ACP update per KB-04):
1. Remove the four `finish` session update emissions entirely — the `session/prompt` response `stopReason` field already communicates the stop reason to the client.
2. See ISS-103 which recommends this approach.
