# ISS-005 — WRFC Orchestrator Emits No ACP tool_call / tool_call_update Notifications

**Severity**: Critical
**File**: src/extensions/wrfc/orchestrator.ts:114-338
**KB Topic**: WRFC as Tool Calls (10-implementation-guide.md, Section 6)

## Original Issue
The orchestrator emits only internal EventBus events. It never produces ACP session/update notifications for WRFC phases. No ACP client can observe work, review, or fix progress.

## Verification

### Source Code Check
The orchestrator emits events exclusively through `this.eventBus.emit()` calls:
```typescript
// Line 149: this.eventBus.emit('wrfc:state-changed', { ... });
// Line 197: this.eventBus.emit('wrfc:work-complete', { ... });
// Line 236: this.eventBus.emit('wrfc:review-complete', { ... });
// Line 276: this.eventBus.emit('wrfc:fix-complete', { ... });
// Line 313: this.eventBus.emit('wrfc:cancelled', { ... });
// Line 330: this.eventBus.emit('wrfc:chain-complete', { ... });
```
The orchestrator has no reference to `AgentSideConnection` and never calls `conn.sessionUpdate()`. All events are internal-only.

### ACP Spec Check
KB-10 (10-implementation-guide.md) describes WRFC phases as tool_call update sequences:
```typescript
await this.conn.sessionUpdate({
  sessionId: p.sessionId,
  update: { sessionUpdate: 'tool_call', toolCallId: '...', title: '...', kind: 'other', status: 'pending' },
});
```

KB-04 (04-prompt-turn.md) defines `tool_call` and `tool_call_update` as the mechanism for surfacing work progress to clients.

The `WRFC_TOOL_NAMES` constants in constants.ts (`goodvibes_work`, `goodvibes_review`, `goodvibes_fix`) exist but are never used by the orchestrator.

### Verdict: CONFIRMED
The orchestrator is completely disconnected from the ACP protocol layer. WRFC phases (work, review, fix) generate internal EventBus events but no ACP `tool_call`/`tool_call_update` notifications. Clients have zero visibility into WRFC progress.

## Remediation
1. Either inject `AgentSideConnection` (or a `ToolCallEmitter`) into the orchestrator, or
2. Add an ACP bridge layer (similar to `AgentEventBridge`) that subscribes to `wrfc:*` EventBus events and translates them to `tool_call`/`tool_call_update` notifications
3. Each WRFC phase should emit: `tool_call` (pending) -> `tool_call_update` (in_progress) -> `tool_call_update` (completed/error)
4. Use `WRFC_TOOL_NAMES` constants for tool names
5. Include `_meta` with `_goodvibes/phase`, `_goodvibes/attempt`, `_goodvibes/score`
