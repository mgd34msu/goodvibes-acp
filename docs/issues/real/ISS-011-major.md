# ISS-011 — ToolCallStatus 'cancelled' Mapped to 'failed'

**Severity**: Major
**File**: src/extensions/acp/agent-event-bridge.ts:86
**KB Topic**: ToolCallStatus (04-prompt-turn.md lines 206-217)

## Original Issue
When agent status transitions to `cancelled`, the bridge maps it to ACP `ToolCallStatus: 'failed'`. The spec defines `'cancelled'` as a valid distinct status. KB-04: `ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error"`. Cancelled operations must use `'cancelled'`, not `'failed'`. Clients use this to distinguish cancellation from error.

## Verification

### Source Code Check
At `agent-event-bridge.ts:86`, the status mapping is:
```typescript
const status: acp.ToolCallStatus =
  to === 'running'    ? 'in_progress'
  : to === 'completed'  ? 'completed'
  : to === 'cancelled'  ? 'failed'      // <-- wrong
  : to === 'failed'     ? 'failed'
  : 'in_progress';
```
The `cancelled` internal state is mapped to `'failed'` instead of `'cancelled'`.

### ACP Spec Check
KB-04 (prompt-turn.md line 207) defines:
```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";
```
With status lifecycle: `pending` -> `in_progress` -> `completed` | `cancelled` | `error`.

`'cancelled'` is a first-class terminal status in ACP, distinct from error/failure.

### Verdict: CONFIRMED
The code explicitly maps `cancelled` to `'failed'`, losing the semantic distinction that ACP clients rely on to differentiate user-initiated cancellation from errors. The ACP spec clearly defines `'cancelled'` as a valid terminal status.

## Remediation
1. Change line 86 from `to === 'cancelled' ? 'failed'` to `to === 'cancelled' ? 'cancelled'`
2. This is a one-line fix with no downstream impact since `'cancelled'` is already a valid `ToolCallStatus` in the ACP SDK types.
