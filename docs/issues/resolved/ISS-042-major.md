# ISS-042 — Cancelled tool executions not reported via progress callback

**Severity**: Major
**File**: `src/plugins/agents/loop.ts`
**KB Topic**: KB-04: Session Cancel

## Original Issue
When cancellation is detected before tool execution, the loop pushes a `tool_result` with `is_error: true` but does not emit an `onProgress` event. The ACP client cannot send `tool_call_update` with `status: 'cancelled'`.

## Verification

### Source Code Check
Lines 219-227 show the cancellation path:
```typescript
if (this.config.signal?.aborted) {
  results.push({
    type: 'tool_result',
    tool_use_id: block.id,
    content: 'Cancelled',
    is_error: true,
  });
  continue;
}
```
No `onProgress` call is made before pushing the cancelled result. Compare with the normal tool path which emits `tool_start` (line 230), `tool_complete` (line 254), and `tool_error` (line 264-269).

### ACP Spec Check
KB-04 line 207 defines `ToolCallStatus` as including `'cancelled'`. Line 217 shows the lifecycle: `pending -> in_progress -> completed | cancelled | error`. The ACP layer needs a progress event to emit `tool_call_update` with `status: 'cancelled'`.

### Verdict: CONFIRMED
The cancellation path pushes a tool_result but emits no progress event. The ACP bridge has no way to know a tool was cancelled and cannot emit the appropriate `tool_call_update`.

## Remediation
1. Emit `onProgress({ type: 'tool_cancelled', turn, toolName: block.name })` before pushing the error tool result
2. Handle this event type in the ACP bridge to emit `tool_call_update` with `status: 'cancelled'`
