# ISS-034: Cancelled tools missing ACP `tool_call_update` status events

**Severity**: Major
**Category**: KB-04/KB-06 Tool Calls
**File**: `src/plugins/agents/loop.ts`
**Lines**: 234-244

## Description

When cancellation is detected before tool execution (`this.config.signal?.aborted`), the loop pushes a `tool_result` content block with `is_error: true` but does not emit any `tool_call_update` session update with `status: 'cancelled'`. Clients tracking tool call lifecycle see phantom pending tool calls that never resolve.

### Verdict: CONFIRMED

Grep for `tool_call_update` in `loop.ts` returned zero matches. The cancellation path (lines 237-244) only creates a `tool_result` content block — no session update notification is emitted. ACP clients relying on `tool_call_update` events for UI status will show tools stuck in `pending` state.

## Remediation

1. Before pushing the cancelled `tool_result`, emit a `tool_call_update` session update:
   ```typescript
   this.config.onSessionUpdate?.({ sessionUpdate: 'tool_call_update', toolCallId: block.id, status: 'cancelled' });
   ```
2. Apply to all tool blocks that are skipped due to cancellation.

## ACP Reference

KB-04: Session updates must reflect tool call lifecycle transitions.
KB-06: Every tool call must progress through status updates to a terminal state.
