# ISS-045 — WRFC Cancellation Mapped to `'failed'` State — Conflates Cancel and Error

**Severity**: Major
**File**: src/extensions/wrfc/orchestrator.ts:296-320
**KB Topic**: Stop Reasons / Cancellation (04-prompt-turn.md)

## Original Issue
When the signal is aborted, the orchestrator drives the state machine to `'failed'` via `WRFC_EVENTS.FAIL` instead of a distinct `'cancelled'` state. No `stopReason: 'cancelled'` is produced.

## Verification

### Source Code Check
At lines 296-313, the cancellation handling:
```typescript
} catch (err) {
  const isAbort =
    (err instanceof DOMException && err.name === 'AbortError') || signal?.aborted;

  if (isAbort) {
    // Drive the machine to a terminal state via the FAIL event.
    // A dedicated CANCEL event/state is not available in the current L0 types;
    // the cancelledAt timestamp in context distinguishes this from a genuine failure.
    if (!WRFC_TERMINAL_STATES.has(machine.current())) {
      machine.transition(WRFC_EVENTS.FAIL);
    }
    machine.updateContext((ctx) => ({
      ...ctx,
      cancelledAt: Date.now(),
    }));
```
The code explicitly acknowledges the limitation in comments but still uses `WRFC_EVENTS.FAIL` for cancellations, relying on a `cancelledAt` timestamp to distinguish from genuine failures.

### ACP Spec Check
KB-04 (line 462): "Agents MUST catch abort exceptions and return `cancelled` — not an error response."
KB-04 (line 486): "Agent MUST eventually respond to the original `session/prompt` request with `{ stopReason: 'cancelled' }`."
KB-04 (line 67): `type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";`

The spec explicitly requires a `cancelled` stop reason, not an error/failed state.

### Verdict: CONFIRMED
The code uses `WRFC_EVENTS.FAIL` for cancellation, which maps to a `'failed'` terminal state. The `cancelledAt` timestamp workaround is insufficient because: (1) consumers checking terminal state see `'failed'` not `'cancelled'`, (2) no `stopReason: 'cancelled'` is propagated to the ACP layer, and (3) the spec uses MUST language for returning `cancelled`.

## Remediation
1. Add a `CANCEL` event and `'cancelled'` state to the L0 WRFC state machine types.
2. Use `machine.transition(WRFC_EVENTS.CANCEL)` instead of `WRFC_EVENTS.FAIL` for abort cases.
3. Ensure the ACP layer maps the `'cancelled'` terminal state to `{ stopReason: 'cancelled' }` in the `session/prompt` response.
4. Remove the `cancelledAt` workaround once proper state support exists.
