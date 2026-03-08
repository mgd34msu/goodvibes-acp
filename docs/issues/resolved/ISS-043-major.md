# ISS-043 — Unknown LLM stop reasons silently mapped to end_turn, masking refusal

**Severity**: Major
**File**: `src/plugins/agents/loop.ts`
**KB Topic**: KB-04: StopReason

## Original Issue
The fallback maps all unknown stop reasons to `end_turn`. ACP defines `refusal` as a valid StopReason. If the LLM provider returns a refusal-equivalent, it is silently converted to `end_turn`.

## Verification

### Source Code Check
Lines 170-183 show the stop reason handling:
```typescript
// end_turn or max_tokens — agent is done
if (response.stopReason === 'end_turn' || response.stopReason === 'max_tokens') {
  return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'end_turn' };
}

// tool_use — execute tools and feed results back
if (response.stopReason === 'tool_use') { ... }

// Unknown stop reason — treat as end_turn
return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'end_turn' };
```
The `AgentLoopResult.stopReason` type is `'end_turn' | 'max_turn_requests' | 'cancelled' | 'error'` (line 78) — `refusal` is not included.

### ACP Spec Check
KB-04 lines 446-460 define StopReason as:
```typescript
type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
```
`refusal` means "Agent refuses to continue" — a semantically distinct outcome from `end_turn`.

### Verdict: CONFIRMED
The code has no handling for `refusal` stop reasons. The `AgentLoopResult.stopReason` union type omits `refusal` entirely. Any provider refusal is silently mapped to `end_turn`, losing important diagnostic information.

## Remediation
1. Add `'refusal'` to the `AgentLoopResult.stopReason` union type
2. Add an explicit check for `refusal` stop reasons before the unknown fallback
3. Map provider-specific refusal signals (e.g., content filtering) to ACP `refusal`
4. Preserve unknown stop reasons or log a warning instead of silently converting
