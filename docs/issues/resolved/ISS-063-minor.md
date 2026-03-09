# ISS-063: Shutdown grace period ignores agentGracePeriodMs config

**Severity**: Minor  
**File**: `src/main.ts`  
**Lines**: 436  
**KB Reference**: KB-10 (Implementation)  
**Issue Source**: docs/issues-combined.md #63

## Description

The shutdown function on line 436 uses a hardcoded 2-second timer (`setTimeout(() => process.exit(0), 2000)`) to allow the event loop to drain. The `RuntimeConfig.runtime.agentGracePeriodMs` (default 10000ms, defined in `src/core/config.ts` line 22) is never consulted.

### Verdict: CONFIRMED

Line 436: `setTimeout(() => process.exit(0), 2000).unref();` — hardcoded 2000ms.

The config default `agentGracePeriodMs: 10000` exists in config.ts but is never referenced in the shutdown path. The 2-second timeout may be too short for agents to complete graceful teardown, especially when multiple MCP servers need disconnection.

## Remediation

1. Read `config.get<number>('runtime.agentGracePeriodMs')` in the shutdown function
2. Use that value (or a reasonable default) for the exit timer

```typescript
async function shutdown(signal: string): Promise<void> {
  console.error(`[goodvibes-acp] Received ${signal}, shutting down...`);
  healthCheck.markShuttingDown();
  await shutdownManager.shutdown();
  const gracePeriod = config.get<number>('runtime.agentGracePeriodMs') ?? 10000;
  setTimeout(() => process.exit(0), gracePeriod).unref();
}
```
