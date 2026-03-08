# ISS-069 — Mode change does not emit dual configOptions + modes notification

**Severity**: Minor
**File**: `src/extensions/acp/session-adapter.ts`
**KB Topic**: KB-03: Backwards Compatibility

## Original Issue
The `_onSessionModeChanged` handler emits only `current_mode_update`. KB-03 recommends that during the transition period, agents SHOULD send both formats so clients supporting either API receive updates.

## Verification

### Source Code Check
In `src/extensions/acp/session-adapter.ts` lines 165-178, `_onSessionModeChanged` constructs and sends only a `current_mode_update` session update:
```typescript
const update: schema.SessionUpdate = {
  sessionUpdate: 'current_mode_update' as const,
  currentModeId: to,
};
await this._safeSessionUpdate(sessionId, update);
```
No `config_option_update` notification is emitted alongside it.

### ACP Spec Check
KB-03 (line 403): "For backwards compatibility, agents SHOULD send both `configOptions` and `modes` during the transition period." The SDK supports both `current_mode_update` and `config_option_update` as valid `SessionUpdate` discriminators. Clients relying solely on `config_option_update` will not see mode changes.

### Verdict: CONFIRMED
The code only emits `current_mode_update` on mode change and does not emit a corresponding `config_option_update`. This violates the SHOULD-level recommendation in KB-03 for dual-format notifications during the transition period.

## Remediation
1. After emitting `current_mode_update`, also emit a `config_option_update` with the full `configOptions` array reflecting the new mode
2. Use `buildConfigOptions()` from `config-adapter.ts` to construct the `configOptions` payload
3. Example:
```typescript
const configUpdate: schema.SessionUpdate = {
  sessionUpdate: 'config_option_update',
  configOptions: buildConfigOptions(/* current session config */),
};
await this._safeSessionUpdate(sessionId, configUpdate);
```
