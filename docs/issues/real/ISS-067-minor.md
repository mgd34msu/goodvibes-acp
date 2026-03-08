# ISS-067 — toSessionModeState is dead code

**Severity**: Minor
**File**: `src/extensions/sessions/modes.ts`
**KB Topic**: KB-03: Legacy Modes API

## Original Issue
`toSessionModeState` is exported but never imported or called. KB-03 says agents SHOULD send both `configOptions` and `modes` during the transition period. If legacy modes support is intentionally omitted, the function should be removed.

## Verification

### Source Code Check
The function `toSessionModeState` exists at lines 138-150 of `src/extensions/sessions/modes.ts`. A grep across all `src/**/*.ts` files confirms it is only referenced within its own file (definition and JSDoc example) — never imported or called from any other module.

### ACP Spec Check
KB-03 (line 403) states: "For backwards compatibility, agents SHOULD send both `configOptions` and `modes` during the transition period." The function exists to generate the legacy modes wire format, but it is never used. The SDK still includes `SessionModeState` type, confirming legacy modes support is still part of the protocol.

### Verdict: CONFIRMED
The function is dead code. It was presumably written to support KB-03's backwards compatibility recommendation but was never wired in. This means the agent does not send legacy `modes` data during the transition period, violating the SHOULD-level recommendation.

## Remediation
1. Wire `toSessionModeState` into the `session/new` response to include legacy `modes` alongside `configOptions`
2. Alternatively, if the decision is to not support legacy modes, remove the dead function and document the deliberate deviation from KB-03
