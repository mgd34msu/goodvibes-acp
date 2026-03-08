# ISS-012 — ToolCallStatus 'failed' Is Not a Valid ACP Value

**Severity**: Major
**File**: src/extensions/acp/agent-event-bridge.ts:87
**KB Topic**: ToolCallStatus (04-prompt-turn.md lines 206-217)

## Original Issue
When agent status transitions to `failed`, the bridge maps it to `ToolCallStatus: 'failed'`. The spec uses `'error'` as the terminal failure status. `'failed'` is not a valid `ToolCallStatus` value and will be rejected or silently ignored by compliant clients.

## Verification

### Source Code Check
At `agent-event-bridge.ts:87`, the status mapping is:
```typescript
: to === 'failed'     ? 'failed'
```
The internal `failed` state is mapped to ACP `'failed'`.

### ACP Spec Check
KB-04 (prompt-turn.md line 207) defines:
```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";
```
The terminal failure status is `"error"`, not `"failed"`. `"failed"` does not appear in the union type.

### Verdict: CONFIRMED
The code emits `'failed'` which is not a valid ACP `ToolCallStatus` value. The correct terminal failure status per the spec is `'error'`. Compliant clients performing strict validation will reject or ignore this value.

## Remediation
1. Change line 87 from `to === 'failed' ? 'failed'` to `to === 'failed' ? 'error'`
2. Combined with ISS-011, the final mapping should be:
```typescript
const status: acp.ToolCallStatus =
  to === 'running'    ? 'in_progress'
  : to === 'completed'  ? 'completed'
  : to === 'cancelled'  ? 'cancelled'
  : to === 'failed'     ? 'error'
  : 'in_progress';
```
