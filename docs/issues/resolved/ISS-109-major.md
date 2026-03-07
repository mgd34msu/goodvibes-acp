# ISS-109 — No Guarantee ACP Bridge Is Registered Before Orchestrator Emits Events

**Severity**: Major
**File**: src/extensions/wrfc/orchestrator.ts (general)
**KB Topic**: Prompt Turn

## Original Issue
No guarantee ACP bridge is registered before orchestrator emits events. *(Prompt Turn)*

## Verification

### Source Code Check
The `WRFCOrchestrator` in `src/extensions/wrfc/orchestrator.ts` emits several EventBus events:
- `wrfc:state-changed` (line 149)
- `wrfc:work-complete` (line 196)
- `wrfc:review-complete` (line 235)
- `wrfc:fix-complete` (line 275)
- `wrfc:cancelled` (line 313)
- `wrfc:chain-complete` (line 330)

The orchestrator receives an `EventBus` in its constructor:
```typescript
constructor(
  private readonly config: WRFCConfig,
  private readonly eventBus: EventBus,
) {}
```

The `AgentEventBridge` in `src/extensions/acp/agent-event-bridge.ts` listens on `agent:registered` and `agent:status-changed` (not WRFC events directly). The WRFC events would be consumed by `src/extensions/wrfc/handlers.ts`, which listens on `wrfc:state-changed`.

Looking at `src/extensions/acp/agent.ts`, the orchestrator (`this.wrfc`) and the connection (`this.conn`) are injected together. The ACP bridge components (`planEmitter`, `commandsEmitter`, `agentEventBridge`) are also injected. There is no explicit ordering guarantee that bridge listeners are registered before `wrfc.run()` is called.

If bridge listeners are registered lazily or asynchronously, events emitted at the start of `wrfc.run()` (e.g., the first `wrfc:state-changed` on `machine.transition(WRFC_EVENTS.START)` at line 163) could fire before bridge listeners are in place.

### ACP Spec Check
The ACP spec does not define internal initialization ordering requirements. However, it does require that the agent correctly stream tool call updates and session updates — if the ACP bridge misses events due to a race condition, the client receives an incomplete picture of agent activity, which violates the spirit of the spec's streaming requirements.

From `docs/acp-knowledgebase/04-prompt-turn.md`: tool_call and tool_call_update events must be emitted in the correct sequence (`pending` → `in_progress` → terminal). Missing an initial event breaks this sequence.

### Verdict: PARTIAL
The concern is real — there is no explicit ordering contract in the code ensuring bridge listeners are registered before `wrfc.run()` is called. However, the issue is vaguely described ("general" file reference, no specific lines) and the actual initialization path in `src/extensions/acp/agent.ts` would need to be verified to confirm whether a real race exists. In Node.js/TypeScript, constructor-time listener registration is synchronous, so if bridges register in the constructor, there is no race. The issue is partially valid — the code lacks defensive documentation and explicit initialization ordering, but a runtime race may not exist depending on the construction order.

## Remediation
1. Document the required initialization order explicitly: ACP bridge components (AgentEventBridge, PlanEmitter, CommandsEmitter) must register their event listeners before `prompt()` (and thus `wrfc.run()`) is called.
2. Add an `initialize()` or `register()` call that must be completed before accepting prompts — enforce this with a guard:
   ```typescript
   if (!this._bridgesRegistered) {
     throw new Error('ACP bridges must be registered before processing prompts');
   }
   ```
3. Alternatively, use synchronous listener registration in the constructor chain to eliminate the window entirely.
