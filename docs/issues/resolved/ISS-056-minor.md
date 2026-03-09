# ISS-056: No legacy `modes` in session/load response

**Severity**: Minor
**Category**: KB-03 Sessions
**File**: `src/extensions/acp/agent.ts`
**Lines**: 325-331

## Description

The load session response returns `configOptions` but not the `modes` field. The ACP SDK defines both as optional in `LoadSessionResponse`.

### Verdict: CONFIRMED

SDK `LoadSessionResponse` (types.gen.d.ts line 1251) includes:
```typescript
configOptions?: Array<SessionConfigOption> | null;
modes?: SessionModeState | null;
```
Both `NewSessionResponse` and `LoadSessionResponse` support `modes` alongside `configOptions`. The current implementation at agent.ts line 325 only returns `configOptions`. While `modes` is optional, including it improves interoperability with clients that rely on the `modes` field for session mode state (e.g., existing Claude Code clients).

## Remediation

1. Build a `SessionModeState` object from the current mode configuration.
2. Return both `configOptions` and `modes` in `newSession` and `loadSession` responses.
3. Example: `modes: { current: currentMode.id, available: allModes }`.

## ACP Reference

KB-03: `LoadSessionResponse` and `NewSessionResponse` support both `configOptions` and `modes`. Including both maximizes client compatibility.
