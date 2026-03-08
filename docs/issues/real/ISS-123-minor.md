# ISS-123 — `WRFCEventBridge` does not handle `'checking'` state transition

**Severity**: Minor
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 106-173
**KB Topic**: KB-10: WRFC Lifecycle

## Original Issue
The state-changed handler emits tool_call announcements for `working`, `reviewing`, and `fixing`, but not `checking`. This creates a visibility gap in the WRFC lifecycle.

## Verification

### Source Code Check
The WRFC state machine (machine.ts lines 88-97) defines these states:
- `idle`, `working`, `reviewing`, `fixing`, `checking`, `complete`, `escalated`, `failed`, `cancelled`

The `checking` state is a real state reached after `fixing` completes (machine.ts line 152: `from: 'fixing', to: 'checking'`). It represents a post-fix re-review phase.

The wrfc-event-bridge.ts state-changed handler (lines 106-173) only handles:
- `payload.to === 'working'` (line 106)
- `payload.to === 'reviewing'` (line 129)
- `payload.to === 'fixing'` (line 151)

No branch for `payload.to === 'checking'` exists. When the machine transitions to `checking`, no tool_call is emitted to the ACP client.

### ACP Spec Check
The WRFC lifecycle (per KB-10) should provide full visibility to the client through tool_call session updates. Missing the `checking` phase means clients cannot display the post-fix re-review activity.

### Verdict: CONFIRMED
The `checking` state is a valid WRFC machine state with transitions defined, but the event bridge does not emit a tool_call for it, creating a visibility gap.

## Remediation
1. Add an `else if (payload.to === 'checking')` branch after the `fixing` branch.
2. Emit a tool_call with `kind: 'think'` (or `'other'`), title like `'Post-fix review (checking)...'`.
3. Add a corresponding `WRFC_TOOL_NAMES.CHECK` constant if one does not exist.
4. Follow the same pattern as other phases: emit `emitToolCall` then `emitToolCallUpdate` with `'in_progress'`.
