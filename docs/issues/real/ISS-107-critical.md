# ISS-107 — `max_tokens` stop reason collapsed to `end_turn` — truncated responses reported as successful

**Severity**: Critical  
**File**: `src/plugins/agents/loop.ts`  
**Lines**: 171-172  
**KB Reference**: KB-04 (StopReason)  
**Iteration**: 3

## Description

When the LLM returns `max_tokens` as the stop reason, the agent loop maps it to `end_turn` in its result. ACP defines `max_tokens` as a distinct `StopReason` with different semantics: "Maximum token limit reached" vs "LLM finished without requesting more tools". This causes the ACP layer to misreport truncated responses as successful completions.

## Source Evidence

```typescript
// src/plugins/agents/loop.ts:171-172
if (response.stopReason === 'end_turn' || response.stopReason === 'max_tokens') {
  return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'end_turn' };
}
```

The `AgentLoopResult.stopReason` type on line 78 confirms `max_tokens` is not in the union:
```typescript
stopReason: 'end_turn' | 'max_turn_requests' | 'cancelled' | 'error';
```

## Spec Evidence

KB-04:
```typescript
type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
```

`max_tokens` is a distinct, valid stop reason that clients need to differentiate from `end_turn`.

### Verdict: CONFIRMED

The code explicitly collapses `max_tokens` into `end_turn`, losing critical information about response truncation. Clients receiving `end_turn` have no way to know the response was cut short.

## Remediation

1. Add `'max_tokens'` to the `AgentLoopResult.stopReason` type union
2. Propagate the original stop reason: `return { ..., stopReason: response.stopReason }`
3. Ensure the ACP session adapter layer forwards `max_tokens` to the client in the `session/prompt` response
4. Consider also adding `'refusal'` to the type union per the spec
