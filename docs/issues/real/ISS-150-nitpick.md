# ISS-150 — `AgentLoopResult.stopReason` includes `error` but ACP `StopReason` does not

**Severity**: nitpick
**File**: `src/plugins/agents/loop.ts`
**Lines**: 72-78
**KB Reference**: KB-04 (StopReason)

## Issue Description

The `AgentLoopResult.stopReason` type includes `'error'` as a union member, but the ACP-defined `StopReason` type does not include `'error'`. The code documents this as an intentional internal extension.

## Source Evidence

- `src/plugins/agents/loop.ts` line 78: `stopReason: 'end_turn' | 'max_turn_requests' | 'cancelled' | 'error';`
- KB-04 defines: `type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";`
- Code comment (lines 73-77) explicitly notes: `'error' is an internal extension value — ACP has no error stop reason. It is translated at the L2 ACP layer and never sent to clients directly.`

### Verdict: CONFIRMED

The `'error'` value is indeed not part of the ACP `StopReason` type. However, the code already documents this as intentional and states it is translated at the L2 layer before reaching the wire. The suggestion to use a branded type is valid but the current approach is functionally correct.

## Remediation

1. Consider using a separate internal type to make the distinction explicit:
   ```typescript
   type AcpStopReason = 'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled';
   type InternalStopReason = AcpStopReason | 'error';
   ```
2. This prevents accidental leakage of `'error'` to the wire via type-level enforcement
3. Also note: the L0 type is missing `'max_tokens'` and `'refusal'` from the ACP spec — these should be added
