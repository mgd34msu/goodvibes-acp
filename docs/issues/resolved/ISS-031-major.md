# ISS-031: session/new response missing legacy modes field

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**Line(s)**: 137-160
**Topic**: Sessions

## Issue Description
`session/new` response does not include legacy `modes` field. Spec: agents SHOULD send both `configOptions` and `modes` during the transition period. Add `modes: { currentModeId, availableModes }` alongside `configOptions`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md, lines 401-442
- **Spec Says**: "Deprecated in favor of configOptions. Dedicated mode methods will be removed in a future protocol version. For backwards compatibility, agents SHOULD send both `configOptions` and `modes` during the transition period." The response MAY include both `configOptions` and `modes`.
- **Confirmed**: Yes
- **Notes**: Spec uses SHOULD (not MUST) for backward compatibility. This is advisory but important for interoperability with older clients.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: At lines 161-163, `newSession()` returns `{ sessionId, configOptions: buildConfigOptions() }` with no `modes` field.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Build a `SessionModeState` object from the MODE_DEFINITIONS in `modes.ts`
2. Return `modes: { currentModeId: 'justvibes', availableModes: [...] }` alongside `configOptions` in the `newSession` response
3. Include `id`, `name`, and `description` for each available mode per the `SessionMode` interface
