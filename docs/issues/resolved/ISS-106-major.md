# ISS-106 — 'cancelled' Agent Status Maps to 'failed' ToolCallStatus Instead of 'cancelled'

**Severity**: Major
**File**: src/extensions/acp/agent-event-bridge.ts:86
**KB Topic**: Prompt Turn

## Original Issue
Maps `cancelled` agent status to ACP `'failed'` ToolCallStatus. Spec defines `'cancelled'` as valid. *(Prompt Turn)*

## Verification

### Source Code Check
`src/extensions/acp/agent-event-bridge.ts:83-87`:
```typescript
const status: acp.ToolCallStatus =
  to === 'running' ? 'in_progress'
  : to === 'completed' ? 'completed'
  : to === 'failed' || to === 'cancelled' ? 'failed'
  : 'in_progress';
```

Both the internal `'failed'` and `'cancelled'` agent states are collapsed into the ACP `'failed'` status. The `'cancelled'` case is explicitly handled but incorrectly mapped.

### ACP Spec Check
From `docs/acp-knowledgebase/04-prompt-turn.md`:
```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";
```

The spec also defines the status lifecycle:
> **Status lifecycle:** `pending` → `in_progress` → `completed` | `cancelled` | `error`

`cancelled` is a distinct terminal status in the ACP `ToolCallStatus` type. The spec further notes (in session/cancel docs): "Client SHOULD preemptively mark all non-finished tool calls for the current turn as `cancelled`."

Also from the spec: if `granted: false` (permission denied), the agent "reports tool_call_update (status: \"failed\"), reason: permission denied" — so `failed` and `cancelled` have distinct semantic meanings.

Note: The spec's `ToolCallStatus` uses `"error"` (not `"failed"`) for error terminal state, which is a separate concern (ISS in own right — the code uses `'failed'` where spec uses `'error'`).

### Verdict: CONFIRMED
The code conflates two semantically distinct terminal states. A cancelled agent (user cancelled via `session/cancel`) should report `'cancelled'` status, not `'failed'`. This prevents the client from correctly distinguishing:
- A tool that was interrupted by user cancellation (`cancelled`)
- A tool that encountered an error or was refused (`error`/`failed`)

The mapping is on a single line and the correct fix is trivial.

## Remediation
1. Fix the status mapping in `src/extensions/acp/agent-event-bridge.ts:83-87`:
   ```typescript
   const status: acp.ToolCallStatus =
     to === 'running'    ? 'in_progress'
     : to === 'completed'  ? 'completed'
     : to === 'cancelled'  ? 'cancelled'
     : to === 'failed'     ? 'error'
     : 'in_progress';
   ```
2. Note the secondary fix: map internal `'failed'` to ACP `'error'` (not `'failed'`), as the spec's terminal error status is `"error"`, not `"failed"`.
