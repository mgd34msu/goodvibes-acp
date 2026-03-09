# ISS-055: `plan` mode denies `shell` instead of prompting per ask-mode semantics

**Severity**: Minor
**Category**: KB-05 Permissions
**File**: `src/extensions/acp/permission-gate.ts`
**Lines**: 55-58

## Description

The `plan` mode places `shell` and `file_delete` in `alwaysDeny`, which unconditionally blocks them. ACP ask-mode semantics require calling `request_permission` for every gated action so the user can decide.

### Verdict: CONFIRMED

Source at lines 52-58 of `permission-gate.ts`:
```typescript
plan: {
    autoApprove: [],
    alwaysDeny: ['shell', 'file_delete'],
    promptForUnknown: true,
},
```
The `alwaysDeny` list prevents the permission system from ever prompting the user for `shell` and `file_delete` actions. Per ACP permission semantics (KB-05), a restrictive mode should still allow the agent to call `request_permission` so the user retains agency. The existing ISS-098 comment in the code acknowledges this pattern but only fixed `file_write` — `shell` and `file_delete` remain in `alwaysDeny`.

## Remediation

1. Remove `shell` and `file_delete` from `alwaysDeny` in the `plan` mode config.
2. These actions will then fall through to `promptForUnknown: true`, which correctly calls `request_permission` for user decision.
3. Optionally add a `defaultDeny` category that prompts but defaults the UI to deny, rather than silently blocking.

## ACP Reference

KB-05: Ask-mode semantics require `request_permission` for gated actions. `alwaysDeny` removes user agency.
