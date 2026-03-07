# ISS-011: Mode change notifications use wrong session update type

**Severity**: Critical
**File**: src/extensions/acp/session-adapter.ts
**Line(s)**: 148-166
**Topic**: Sessions

## Issue Description
Mode change notifications use `session_info_update` instead of spec-mandated `current_mode_update` (with `modeId`) and `config_options_update`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md, lines 458-473
- **Spec Says**: Agent-initiated mode changes MUST be sent as `current_mode_update` notification with `{ sessionUpdate: "current_mode_update", modeId: "<mode>" }`. For the modern configOptions path, a `config_options_update` notification should also be sent.
- **Confirmed**: Yes
- **Notes**: The spec clearly defines two distinct update types for mode changes: the legacy `current_mode_update` (with `modeId` field) and the modern `config_options_update` (with full `configOptions` array). Using `session_info_update` for mode changes is incorrect and will not be recognized by compliant clients.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `_onSessionModeChanged()` at line 148-166 constructs a `session_info_update` with a `title` string "Mode changed to: {to}" and `updatedAt`. It never emits `current_mode_update` or `config_options_update`.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
The mode change handler uses the wrong session update discriminator. Compliant clients listening for `current_mode_update` or `config_options_update` will never receive mode change notifications.

## Remediation Steps
1. Change `_onSessionModeChanged()` to emit `current_mode_update` with `{ sessionUpdate: 'current_mode_update', modeId: to }`
2. Additionally emit a `config_options_update` notification with the full `configOptions` array reflecting the new mode
3. During the transition period, emit both update types for backwards compatibility as recommended by the spec
