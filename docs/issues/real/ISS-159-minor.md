# ISS-159 — No Legacy `modes` Format Produced in session/new Response

**Severity**: Minor
**File**: `src/extensions/sessions/modes.ts`
**KB Topic**: Sessions

## Original Issue
No legacy `modes` response format produced. Spec says agents SHOULD send both `configOptions` and `modes` during transition.

## Verification

### Source Code Check
`src/extensions/sessions/modes.ts` defines `MODE_DEFINITIONS` (a `Record<ModeName, ModeConfig>`) and a `getModeConfig()` helper. These are internal GoodVibes operating mode configurations with fields like `maxAgents`, `minReviewScore`, `autoChain`, `confirmWrites`, `sandboxed`.

None of these internal fields correspond to the ACP wire format `modes` response structure:
```typescript
interface SessionModeState {
  currentModeId: SessionModeId;
  availableModes: SessionMode[];  // [{ id, name, description }]
}
```

The file contains no code to produce a `SessionModeState` object or to populate the `modes` field in a `session/new` response. There is no adapter converting `ModeConfig` → `SessionMode`.

### ACP Spec Check
From KB `03-sessions.md` (lines 401-403):
> **Deprecated in favor of configOptions.** Dedicated mode methods will be removed in a future protocol version. For backwards compatibility, agents **SHOULD** send both `configOptions` and `modes` during the transition period.

The `session/new` response can include:
```json
{
  "sessionId": "sess_abc123def456",
  "configOptions": [...],
  "modes": {
    "currentModeId": "ask",
    "availableModes": [...]
  }
}
```

The spec uses SHOULD (not MUST), indicating a strong recommendation during the transition period but not a hard requirement.

### Verdict: CONFIRMED
The issue is genuine. `modes.ts` defines internal GoodVibes mode configurations but provides no mechanism to produce the ACP `SessionModeState` wire format. During the legacy transition period, agents SHOULD emit both `configOptions` and `modes` in the `session/new` response. GoodVibes appears to omit the `modes` field entirely from `session/new` responses, leaving legacy clients that rely on `modes` unable to display available modes or the current mode.

## Remediation
1. Add a converter function in `src/extensions/sessions/modes.ts` that maps `ModeConfig` → ACP `SessionMode`:
   ```typescript
   function toAcpSessionMode(config: ModeConfig): SessionMode {
     return {
       id: config.name,
       name: config.displayName,
       description: config.description,
     };
   }
   ```
2. Add a `toSessionModeState(currentMode: ModeName): SessionModeState` function:
   ```typescript
   export function toSessionModeState(currentMode: ModeName): SessionModeState {
     return {
       currentModeId: currentMode,
       availableModes: Object.values(MODE_DEFINITIONS).map(toAcpSessionMode),
     };
   }
   ```
3. Integrate this into the `session/new` response handler so it populates `modes` alongside `configOptions` in the response.
