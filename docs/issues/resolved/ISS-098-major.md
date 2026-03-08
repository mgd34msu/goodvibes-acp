# ISS-098 — Plan mode auto-approves `file_write`, contradicting ask-mode semantics

**Severity**: Major  
**File**: `src/extensions/acp/permission-gate.ts`  
**Lines**: 52-56  
**KB Reference**: KB-05 (Permissions, lines 360-370)

## Description

Plan mode maps to ACP "ask mode" per the code comments (line 35: `plan → ask mode`). KB-05 defines ask mode as: "Agent calls `session/request_permission` for every gated action; user sees every prompt."

However, the plan mode policy auto-approves `file_write`:
```typescript
plan: {
  autoApprove: ['file_write'],
  alwaysDeny: ['shell', 'file_delete'],
  promptForUnknown: true,
},
```

This means file writes bypass the permission gate entirely in plan mode, contradicting the ask-mode requirement that every gated action prompts the user.

### Verdict: CONFIRMED

KB-05 is unambiguous: ask mode requires prompting for "every gated action." Auto-approving `file_write` in plan/ask mode violates this requirement. The comment on line 52 ("Auto-approve writes but not deletes") acknowledges the choice but does not justify the ACP deviation.

## Remediation

1. Remove `file_write` from plan mode's `autoApprove` list:
   ```typescript
   plan: {
     autoApprove: [],
     alwaysDeny: ['shell', 'file_delete'],
     promptForUnknown: true,
   },
   ```
2. If auto-approving writes in plan mode is intentional, document it as a deliberate deviation from ACP ask-mode semantics with a rationale.
