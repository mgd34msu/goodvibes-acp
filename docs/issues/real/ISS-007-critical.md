# ISS-007 — `max_tokens` stop reason collapsed to `end_turn` — truncated responses reported as successful

**Severity**: Critical
**File**: `src/plugins/agents/loop.ts`
**KB Topic**: KB-04: StopReason

## Original Issue
When the LLM returns `max_tokens`, the loop maps it to `end_turn` in its result. ACP defines `max_tokens` as a distinct StopReason with different semantics ("Maximum token limit reached" vs "LLM finished without requesting more tools"). This causes the ACP layer to misreport truncated responses as successful completions.

## Verification

### Source Code Check
Lines 171-172 of `src/plugins/agents/loop.ts`:
```typescript
// end_turn or max_tokens — agent is done
if (response.stopReason === 'end_turn' || response.stopReason === 'max_tokens') {
  return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'end_turn' };
}
```

Both `end_turn` and `max_tokens` are collapsed into `stopReason: 'end_turn'`.

### ACP Spec Check
KB-04 lines 446-460 define `StopReason`:
```typescript
type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
```

| Value | Meaning |
|-------|--------|
| `end_turn` | LLM finished without requesting more tools |
| `max_tokens` | Maximum token limit reached |

These are semantically distinct. `max_tokens` means the response was truncated; `end_turn` means it completed normally.

### Verdict: CONFIRMED
The code explicitly collapses `max_tokens` into `end_turn` at line 172. This is a clear violation of KB-04 which defines them as distinct stop reasons with different semantics. A truncated response will be reported as a successful completion, hiding the fact that output was cut off.

## Remediation
1. Propagate `max_tokens` as its own stop reason in the `AgentLoopResult`:
   ```typescript
   if (response.stopReason === 'end_turn') {
     return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'end_turn' };
   }
   if (response.stopReason === 'max_tokens') {
     return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'max_tokens' };
   }
   ```
2. Update the `AgentLoopResult.stopReason` type union to include `'max_tokens'`.
3. Ensure the ACP layer maps `max_tokens` to the ACP `StopReason` value when sending the `session/prompt` response.
