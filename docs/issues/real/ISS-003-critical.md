# ISS-003 — Config Changes Never Trigger config_options_update Notification

**Severity**: Critical
**File**: src/extensions/acp/session-adapter.ts:55-83
**KB Topic**: Config Options System — Agent-Initiated Config Change (03-sessions.md lines 371-395)

## Original Issue
The adapter has no subscription to `session:config-changed` events. When config options change via `setConfigOption`, no `config_options_update` notification is sent to the client. Config state silently diverges.

## Verification

### Source Code Check
```typescript
// src/extensions/acp/session-adapter.ts:55-83
this._subscriptions = [
  this.eventBus.on('session:created', ...),
  this.eventBus.on('session:destroyed', ...),
  this.eventBus.on('session:state-changed', ...),
  this.eventBus.on('session:mode-changed', ...),
];
```
The adapter subscribes to exactly four events. There is no subscription to `session:config-changed` or any config-related event.

### ACP Spec Check
KB-03 (03-sessions.md) lines 371-394 show agent-initiated config change notification:
```json
{
  "sessionUpdate": "config_options_update",
  "configOptions": [ ... ]
}
```

KB-04 (04-prompt-turn.md) lines 414-418:
```typescript
interface ConfigOptionsUpdateUpdate {
  sessionUpdate: "config_options_update";
  configOptions: ConfigOption[]; // complete state, not delta
}
```

The spec requires that when config options change, the agent sends `config_options_update` with the full `configOptions` array. The adapter has no mechanism to detect or forward config changes.

### Verdict: CONFIRMED
The SessionAdapter completely lacks config change notification. When `setConfigOption` is called, internal state updates but the ACP client is never notified, causing silent state divergence.

## Remediation
1. Add a subscription to `session:config-changed` (or equivalent event) in the `register()` method
2. In the handler, build the full `configOptions` array and emit:
   ```typescript
   { sessionUpdate: 'config_options_update', configOptions: [...] }
   ```
3. Ensure the notification includes the complete config state, not just the changed option
