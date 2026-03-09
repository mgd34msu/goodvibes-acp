# ISS-064: Config instance not passed to GoodVibesAgent

**Severity**: Minor  
**File**: `src/main.ts`  
**Lines**: 206  
**KB Reference**: KB-03 (Sessions)  
**Issue Source**: docs/issues-combined.md #64

## Description

The GoodVibesAgent is constructed without access to the Config instance. KB-03 documents that `session/new` responses should include `configOptions` — runtime-configurable settings that the ACP client can display and modify. Without Config access, the agent cannot derive default values for these options from the runtime configuration.

### Verdict: CONFIRMED

Line 206: `new GoodVibesAgent(c, registry, eventBus, sessionManager, wrfcAdapter, mcpBridge)` — no `config` parameter.

The agent has no way to read runtime config values to populate `configOptions` defaults in `NewSessionResponse`. This means session-level config options (like WRFC thresholds, logging level, etc.) cannot be derived from runtime configuration.

## Remediation

1. Add `config: Config` as a constructor parameter to `GoodVibesAgent`
2. Update the factory in `createConnection()` (line 206) to pass `config`
3. Use config values to populate `configOptions` defaults in `newSession()` response

```typescript
(c) => new GoodVibesAgent(c, registry, eventBus, sessionManager, wrfcAdapter, mcpBridge, config),
```
