# ISS-004 — Shutdown Does Not Send finish to Active Sessions

**Severity**: Critical
**File**: src/extensions/lifecycle/shutdown.ts:127-142
**KB Topic**: Implementation Guide Section 14 — Shutdown Checklist (10-implementation-guide.md)

## Original Issue
Active ACP session cleanup on shutdown is entirely unimplemented (marked TODO ISS-074). On SIGINT/SIGTERM, no `finish` event is sent to active sessions. Clients experience abrupt disconnection with no `stopReason`.

## Verification

### Source Code Check
```typescript
// src/extensions/lifecycle/shutdown.ts:126-142
/**
 * TODO (ISS-074): Register an L2 handler that closes active ACP sessions on shutdown.
 *
 * When an in-flight ACP prompt is interrupted by shutdown, the runtime should
 * send a `finish` event with `stopReason: 'cancelled'` for each active session
 * before the process exits.
 */
```
The entire ACP session cleanup section is a TODO comment with no implementation. No shutdown handler is registered.

### ACP Spec Check
KB-10 (10-implementation-guide.md) quick start example shows:
```typescript
await this.conn.sessionUpdate({
  sessionId: p.sessionId,
  update: { sessionUpdate: 'finish', stopReason: 'end_turn' },
});
```

KB-09 (09-typescript-sdk.md) lists `"finish"` as a valid `sessionUpdate` discriminator: "Agent done with response".

The spec requires a `finish` event before disconnection. Without it, clients cannot distinguish between a graceful shutdown and a crash.

### Verdict: CONFIRMED
The code explicitly acknowledges this as unimplemented via the TODO comment. The ShutdownManager has no registered handler for ACP session cleanup. Active sessions are terminated without any protocol-level signal.

## Remediation
1. Implement the handler described in the TODO:
   ```typescript
   shutdownManager.register('acp-sessions', SHUTDOWN_ORDER.L2, async () => {
     for (const session of acpSessionRegistry.activeSessions()) {
       await session.finish({ stopReason: 'cancelled' });
     }
   });
   ```
2. This requires access to the ACP session registry or connection reference
3. Register at SHUTDOWN_ORDER.L2 (200) so it runs after L3 plugins but before L1 core teardown
