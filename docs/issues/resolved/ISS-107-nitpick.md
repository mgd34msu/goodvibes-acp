# ISS-107 — wrfc:phase-changed Event Has No Consumers

**Severity**: Nitpick
**File**: src/extensions/wrfc/handlers.ts:140-147
**KB Topic**: Prompt Turn

## Original Issue
Re-emits `wrfc:state-changed` as `wrfc:phase-changed` — redundant, no consumer found. *(Prompt Turn)*

## Verification

### Source Code Check
`src/extensions/wrfc/handlers.ts:131-147`:
```typescript
private _onStateChanged(payload: {
  workId: string;
  sessionId: string;
  from: WRFCState;
  to: WRFCState;
  attempt: number;
}): void {
  const { workId, sessionId, from, to, attempt } = payload;

  this.eventBus.emit('wrfc:phase-changed', {
    workId,
    sessionId,
    from,
    to,
    attempt,
    timestamp: Date.now(),
  });
}
```

This handler is subscribed to `wrfc:state-changed` and re-emits the same data as `wrfc:phase-changed`. A grep of the entire codebase for `wrfc:phase-changed` finds only one match — the emit site. There are no listeners or consumers for `wrfc:phase-changed`.

The original `wrfc:state-changed` event is emitted by `src/extensions/wrfc/orchestrator.ts:149-155` and handled by `handlers.ts:_onStateChanged`.

### ACP Spec Check
The ACP specification has no requirements about internal event bus architecture, event naming, or WRFC-specific events. This is purely an internal implementation concern. No ACP wire protocol is affected by the presence or absence of this internal event.

### Verdict: NOT_ACP_ISSUE
The issue is technically accurate — `wrfc:phase-changed` is emitted but never consumed, making it dead code. However, this has no bearing on ACP protocol compliance. It is a code quality/dead code concern. The re-emission of `wrfc:state-changed` as `wrfc:phase-changed` with an added `timestamp` field may have been intended for future consumers that were never implemented.

## Remediation
N/A for ACP compliance. For code quality:
1. Remove the `_onStateChanged` handler in `src/extensions/wrfc/handlers.ts` if no consumers are planned.
2. Alternatively, if the `wrfc:phase-changed` event is intended for future ACP bridge integration, add a comment documenting its intended consumer.
