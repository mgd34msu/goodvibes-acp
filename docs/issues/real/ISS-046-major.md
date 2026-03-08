# ISS-046 — WRFC `_onCancelled` Handler Issues Escalation Directive Instead of Cancel

**Severity**: Major
**File**: src/extensions/wrfc/handlers.ts:243-263
**KB Topic**: Cancellation handling (04-prompt-turn.md session/cancel)

## Original Issue
The `_onCancelled` handler emits a directive with `action: 'escalate'` for cancelled chains instead of a completion directive.

## Verification

### Source Code Check
At lines 243-263:
```typescript
private _onCancelled(payload: { workId: string; sessionId: string }): void {
  const { workId, sessionId } = payload;

  this.eventBus.emit('wrfc:notification', {
    phase: 'cancelled',
    workId,
    sessionId,
    message: 'WRFC chain cancelled.',
    timestamp: Date.now(),
  });

  const directive: Directive = {
    id: crypto.randomUUID(),
    action: 'escalate',
    workId,
    priority: 'high',
    createdAt: Date.now(),
    meta: { sessionId, reason: 'cancelled' },
  };
  this.directiveQueue.enqueue(directive);
}
```
The handler emits an `'escalate'` directive with `priority: 'high'` when a WRFC chain is cancelled.

### ACP Spec Check
KB-04 (line 486): "Agent MUST eventually respond to the original `session/prompt` request with `{ stopReason: 'cancelled' }`."
KB-04 (line 462): "Agents MUST catch these and return `cancelled` — not an error response. Clients display unrecognized errors to users, which is undesirable for intentional cancellations."

Cancellation is a normal, user-initiated operation. It should produce a clean completion signal, not an escalation that implies system failure requiring human intervention.

### Verdict: CONFIRMED
The handler treats user-initiated cancellation as an escalation-worthy event. This is semantically incorrect: escalation implies a failure requiring human intervention, while cancellation is a normal user action. The `'escalate'` action may trigger unnecessary alerting/intervention workflows. The ACP spec requires a clean `cancelled` response, not an error escalation.

## Remediation
1. Change the directive `action` from `'escalate'` to `'complete'` (or a dedicated `'cancel'` action if the directive system supports it).
2. Lower the priority from `'high'` to `'normal'` — cancellation is not urgent.
3. Ensure the directive chain produces `{ stopReason: 'cancelled' }` at the ACP layer.
4. Reserve `'escalate'` directives for genuine failures that require human attention.
