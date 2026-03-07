# ISS-083: Cancellation bypasses state machine integrity

**Severity**: Major
**File**: src/extensions/wrfc/orchestrator.ts
**Line(s)**: 300-312
**Topic**: Prompt Turn

## Issue Description
Cancellation bypasses state machine integrity -- transitions to `failed` via FAIL event then manually overwrites context.state to `escalated`. Split-brain: `machine.current()` returns `failed` while context says `escalated`. Spec requires `stopReason: "cancelled"`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/04-prompt-turn.md lines 448-462
- **Spec Says**: `stopReason: "cancelled"` means "Client cancelled via `session/cancel`". The spec explicitly states: "API client libraries often throw an exception when aborted. Agents MUST catch these and return `cancelled` -- not an error response."
- **Confirmed**: Yes
- **Notes**: The spec is unambiguous that cancellation should produce `stopReason: 'cancelled'`, not `failed` or `escalated`.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 300-312 detect abort via `DOMException`/`signal.aborted`, then:
  1. Transition state machine to `FAIL` event (line 305) -- machine enters `failed` state
  2. Manually overwrite context with `state: 'escalated'` (lines 307-310)
  3. This creates split-brain: `machine.current()` returns `failed`, context says `escalated`
  4. Comment acknowledges: "A 'cancelled' terminal state is not available in L0 types"
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add a `cancelled` terminal state to the WRFC state machine (or a `CANCEL` event that transitions to a proper terminal state)
2. Use the state machine's own transition mechanism instead of manually overwriting context
3. Ensure the ACP prompt response uses `stopReason: 'cancelled'` (not `end_turn` or error)
4. Remove the split-brain workaround of overwriting context.state after a FAIL transition
