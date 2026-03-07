# ISS-147 — HealthCheck EventBus Injected But Never Used to Emit Events

**Severity**: Minor
**File**: src/extensions/lifecycle/health.ts
**KB Topic**: Initialization

## Original Issue
`_eventBus` injected but never used to emit events. Health state transitions should emit events for ACP transport reactivity.

## Verification

### Source Code Check
Lines 39–44 of `src/extensions/lifecycle/health.ts`:

```typescript
// EventBus is injected for future event-driven extensions (e.g. emitting
// health change events). Stored but not actively used in this iteration.
private readonly _eventBus: EventBus;

constructor(eventBus: EventBus) {
  this._eventBus = eventBus;
  this._startedAt = Date.now();
}
```

The comment explicitly acknowledges `_eventBus` is stored for future use but "not actively used in this iteration." The `markReady()` and `markShuttingDown()` methods mutate `_status` without emitting any events. No health state transitions produce EventBus events.

### ACP Spec Check
The ACP KB (`02-initialization.md`) defines the `initialize` response as returning agent capabilities and protocol version. The KB does not explicitly require health state changes to be broadcast over ACP transport. However, the ACP spec's `session/update` notification stream is how agents communicate state changes to clients — if the health subsystem transitions to `degraded` or `shutting_down`, an ACP client has no mechanism to observe this without an integration point.

KB `02-initialization.md` describes health/readiness as relevant to the initialization handshake (the agent must be ready before it can respond to `initialize`). If health events aren't emitted, any component that monitors health via EventBus will not react to degradation — potentially affecting ACP transport behavior (e.g., continuing to accept prompts while `degraded`).

This is a PARTIAL ACP issue — the HealthCheck's failure to emit events doesn't directly violate the ACP wire protocol, but it prevents the runtime from implementing reactive ACP behaviors (e.g., sending error responses when degraded).

### Verdict: PARTIAL
The code has the problem described — `_eventBus` is injected but unused, and the comment confirms this is intentional for now. The issue has partial merit: health state transitions that trigger no events make it impossible for other components (including ACP transport handlers) to react to runtime health changes. This is not a wire-format violation but does affect ACP runtime reactivity.

## Remediation
1. Emit events on `markReady()` and `markShuttingDown()`:
   ```typescript
   markReady(): void {
     if (this._status === 'starting') {
       this._status = 'ready';
       this._eventBus.emit('lifecycle:health-ready', { uptime: Date.now() - this._startedAt });
     }
   }

   markShuttingDown(): void {
     this._status = 'shutting_down';
     this._eventBus.emit('lifecycle:health-shutting-down', {});
   }
   ```
2. Emit a `lifecycle:health-degraded` event from `_deriveStatus()` on first detection of a failing check.
3. Connect the ACP transport layer to listen for `lifecycle:health-shutting-down` to begin orderly disconnect of clients.
