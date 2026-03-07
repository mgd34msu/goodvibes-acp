# ISS-032: session/load response returns configOptions instead of null

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**Line(s)**: 171-201 (specifically line 215)
**Topic**: Sessions

## Issue Description
`session/load` response returns `{configOptions}` but spec requires response MUST be `{result: null}` after history has been streamed. Return `null`; emit config state via `config_options_update` notification before responding.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md, lines 144-151
- **Spec Says**: After all history is streamed as session/update notifications, the response MUST be `{"result": null}`. The spec explicitly shows `"result": null` as the only valid response.
- **Confirmed**: Yes
- **Notes**: Config state should be communicated via `config_options_update` session notification, not in the response body.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: After streaming history as session updates (lines 203-213), the method returns `{ configOptions: buildConfigOptions(...) }` at line 215 instead of `null`.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Before returning from `loadSession()`, emit a `config_options_update` session notification with the current config options
2. Change the return value to `null` (or `{}` if SDK types require an object)
3. Optionally also emit `available_commands` and `current_mode_update` notifications before responding
