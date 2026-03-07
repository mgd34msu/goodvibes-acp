# ISS-086: setConfigOption returns void instead of full config state

**Severity**: Major
**File**: src/extensions/sessions/manager.ts
**Line(s)**: 235
**Topic**: Sessions

## Issue Description
`setConfigOption` returns `void` instead of full config state. Spec says response must include ALL `configOptions`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md lines 342-367
- **Spec Says**: The `session/set_config_option` response must include the complete config state: `"configOptions": [...]` containing ALL options (not just the changed one). The spec explicitly states: "The complete response allows Agents to reflect dependent changes (e.g., changing model affects available reasoning options)."
- **Confirmed**: Yes
- **Notes**: The spec is explicit -- the response MUST include all configOptions to allow clients to update their UI for dependent changes.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 235 declares `async setConfigOption(sessionId: string, key: string, value: string): Promise<void>`. The method returns nothing (`void`). It updates the stored config internally but does not return the updated config state to the caller. The ACP layer calling this method cannot construct the required response.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Change return type from `Promise<void>` to `Promise<ConfigOption[]>` (or equivalent type containing all config options)
2. After updating the stored config, build and return the complete `configOptions` array
3. Ensure the ACP layer uses this return value to construct the `session/set_config_option` JSON-RPC response
