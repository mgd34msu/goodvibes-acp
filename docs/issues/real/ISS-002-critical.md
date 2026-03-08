# ISS-002 — Session Mode Change Emits Wrong Notification Type

**Severity**: Critical
**File**: src/extensions/acp/session-adapter.ts:148-165
**KB Topic**: Session Modes — Agent-Initiated Mode Change (03-sessions.md lines 458-474)

## Original Issue
`_onSessionModeChanged` emits `{ sessionUpdate: 'session_info_update', title: ... }` instead of the required `{ sessionUpdate: 'current_mode_update', modeId: to }`. Clients will not receive mode change signals.

## Verification

### Source Code Check
```typescript
// src/extensions/acp/session-adapter.ts:159-163
const update: schema.SessionUpdate = {
  sessionUpdate: 'session_info_update' as const,
  title: `Mode changed to: ${to}`,
  updatedAt: new Date().toISOString(),
};
```
The code emits a `session_info_update` with a human-readable title string instead of a proper mode change notification.

### ACP Spec Check
KB-03 (03-sessions.md) lines 458-474 show the agent-initiated mode change notification:
```json
{
  "sessionUpdate": "current_mode_update",
  "modeId": "code"
}
```

KB-04 (04-prompt-turn.md) lines 369-371 confirm:
```json
{
  "sessionUpdate": "current_mode_update",
  "modeId": "code"
}
```

The spec requires `current_mode_update` with a `modeId` field. The code sends `session_info_update` with a `title` field. Clients listening for mode changes will never detect them.

### Verdict: CONFIRMED
The code uses the wrong discriminator (`session_info_update` instead of `current_mode_update`) and the wrong payload shape (title string instead of modeId). ACP clients cannot detect mode changes from this notification.

## Remediation
1. Change `sessionUpdate` from `'session_info_update'` to `'current_mode_update'`
2. Replace `title` and `updatedAt` fields with `modeId: to`
3. The corrected update should be: `{ sessionUpdate: 'current_mode_update', modeId: to }`
