# ISS-008: `setConfigOption` does not emit config_options_update notification

**Severity**: Major
**File**: src/extensions/sessions/manager.ts
**Line(s)**: 235-250
**Topic**: Sessions

## Issue Description
`setConfigOption` does not emit any event. Spec requires `config_options_update` session notification on every config change.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md lines 371-398; docs/acp-knowledgebase/04-prompt-turn.md lines 385-419
- **Spec Says**: The `config_options_update` session notification is used for "Agent-Initiated Config Change". However, the `session/set_config_option` request/response pattern already returns the complete config state in its response. The notification is documented for agent-initiated changes (e.g., model fallback, mode switch after planning), not necessarily for every client-initiated `set_config_option` call.
- **Confirmed**: Partial
- **Notes**: The issue conflates two scenarios: (1) client-initiated config changes via `set_config_option` (which returns full state in response -- the agent.ts code does this correctly at lines 380-401), and (2) agent-initiated config changes (which require a `config_options_update` notification). The session manager itself does not need to emit ACP notifications -- that is the agent layer's responsibility. However, the agent layer (agent.ts `setSessionConfigOption`) also does not emit a `config_options_update` notification, relying solely on the response. This is acceptable for client-initiated changes per the spec's request/response pattern.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `setConfigOption()` at lines 235-250 stores the value and returns void. The agent.ts `setSessionConfigOption()` method at lines 380-401 returns `{ configOptions: buildConfigOptions(...) }` which is the correct response format per spec.
- **Issue Confirmed**: Partial

## Verdict
PARTIAL
The `set_config_option` response correctly includes the full config state per spec. The `config_options_update` notification is documented for agent-initiated changes, not client-initiated ones. However, the session manager has no mechanism to trigger agent-initiated config notifications (e.g., when the agent decides to change model due to rate limiting). The issue is real but overstated -- the immediate fix is to add infrastructure for agent-initiated notifications, not to emit a notification on every `setConfigOption` call.

## Remediation Steps
1. Add an event emission from `SessionManager.setConfigOption()` (e.g., `eventBus.emit('session:config-changed', { sessionId, key, value })`)
2. In the agent layer, listen for `session:config-changed` events and emit `config_options_update` notifications when the change was agent-initiated (not in response to a client `set_config_option` request)
3. For client-initiated changes, the existing response with `configOptions` is sufficient per spec
