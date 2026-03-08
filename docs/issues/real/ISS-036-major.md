# ISS-036 — Cancellation Not Checked Between Sequential Tool Executions

**Severity**: Major
**File**: src/plugins/agents/loop.ts:202-251
**KB Topic**: Prompt Turn — session/cancel protocol (04-prompt-turn.md lines 480-487)

## Original Issue
If an agent has multiple tool calls queued and cancellation is requested after the first, the remaining tool calls will still execute.

## Verification

### Source Code Check
In `src/plugins/agents/loop.ts`, cancellation is checked at:
- Line 105: `if (this.config.signal?.aborted)` — before each LLM turn
- Line 123: `if (this.config.signal?.aborted)` — after a caught LLM error

In `_executeToolCalls()` (lines 195-251), tool calls are executed in a `for` loop:
```typescript
for (const block of toolUseBlocks) {
  const startTime = Date.now();
  this.config.onProgress?.({ type: 'tool_start', turn, toolName: block.name });
  // ... execute tool ...
  const result = await provider.execute(toolName, block.input);
  // ... no abort check between iterations ...
}
```
There is **no** `signal.aborted` check between tool executions in the loop. All queued tools execute even after cancellation.

### ACP Spec Check
KB-04 (Prompt Turn, lines 480-487) states: "Agent SHOULD stop all LLM requests and tool invocations as soon as possible." Rule 3 of the `session/cancel` protocol explicitly says the agent should stop tool invocations. Executing remaining queued tools after cancellation violates this SHOULD requirement.

### Verdict: CONFIRMED
The `_executeToolCalls()` method has no cancellation check between sequential tool executions. If 5 tools are queued and the user cancels after the first, tools 2-5 still execute. The spec says the agent SHOULD stop tool invocations as soon as possible.

## Remediation
1. Add an abort check at the start of each loop iteration in `_executeToolCalls()`:
   ```typescript
   for (const block of toolUseBlocks) {
     if (this.config.signal?.aborted) {
       results.push({
         type: 'tool_result',
         tool_use_id: block.id,
         content: 'Cancelled',
         is_error: true,
       });
       continue;
     }
     // ... existing tool execution ...
   }
   ```
2. Consider also passing the abort signal to `provider.execute()` so individual tool executions can be interrupted mid-flight.
