# ISS-142 — Redundant config notification emission alongside response

**Severity**: nitpick
**File**: `src/extensions/acp/agent.ts`
**Line**: 328
**KB Reference**: KB-04 (Config Options Update)

## Issue Description

The `loadSession` method emits `configOptions` as both a `sessionUpdate` notification (line 320) and in the response (line 332). Both paths carry identical `configOptions` payloads.

## Source Evidence

- Lines 320-329: `await this.conn.sessionUpdate({ ... sessionUpdate: 'config_option_update', configOptions: buildConfigOptions(...) })`
- Lines 331-336: `return { configOptions: buildConfigOptions(...) }`

Both spec-compliant, but the duplication is unnecessary.

### Verdict: CONFIRMED

The dual emission is present and redundant. Both the notification and the response carry the same config options built from the same inputs.

## Remediation

1. Choose one delivery mechanism: prefer the response since clients always receive it
2. If the notification is needed for observers that do not receive the response, add a code comment documenting the intentional redundancy
3. Consider removing the notification if no observer relies on it
