# ISS-091 — Missing `emitConfigUpdate` function from KB-10

**Severity**: Minor  
**File**: `src/extensions/acp/config-adapter.ts`  
**Lines**: 133 (EOF)  
**KB Reference**: KB-10 (Implementation Guide, lines 732-746)

## Description

KB-10 describes an `emitConfigUpdate` function that emits agent-initiated config updates via `conn.sessionUpdate()` with `sessionUpdate: 'config_option'`. This function is not present in `config-adapter.ts`, which only exports `buildConfigOptions`, `modeFromConfigValue`, and config ID constants.

### Verdict: CONFIRMED

The KB-10 implementation guide explicitly defines `emitConfigUpdate` as a function that should exist in the config adapter layer. The function is absent from the file. While the functionality may be implemented inline elsewhere, the config-adapter module is the designated location per KB-10.

## Remediation

1. Add `emitConfigUpdate` to `src/extensions/acp/config-adapter.ts`:
   ```typescript
   export async function emitConfigUpdate(
     conn: acp.AgentSideConnection,
     sessionId: string,
     options: schema.SessionConfigOption[],
   ): Promise<void> {
     await conn.sessionUpdate({
       sessionId,
       update: {
         sessionUpdate: 'config_option',
         configOptions: options,
       },
     });
   }
   ```
2. Update any inline config update emissions in `agent.ts` to use this function.
