# ISS-035 — AgentLoopResult.stopReason Uses Non-ACP Values

**Severity**: Major
**File**: src/plugins/agents/loop.ts:72
**KB Topic**: Prompt Turn — Stop Reasons (04-prompt-turn.md lines 446-460)

## Original Issue
`AgentLoopResult.stopReason` uses `'complete'` and `'max_turns'` instead of the ACP-defined `'end_turn'` and `'max_turn_requests'`.

## Verification

### Source Code Check
At `src/plugins/agents/loop.ts:72`, the type is:
```typescript
stopReason: 'complete' | 'max_turns' | 'cancelled' | 'error';
```
The values `'complete'` and `'max_turns'` do not match ACP stop reason values.

### ACP Spec Check
KB-04 (Prompt Turn, lines 446-460) defines:
```typescript
type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
```

| Value               | Meaning                                    |
|---------------------|--------------------------------------------|
| `end_turn`          | LLM finished without requesting more tools |
| `max_tokens`        | Maximum token limit reached                |
| `max_turn_requests` | Maximum model requests per turn exceeded   |
| `refusal`           | Agent refuses to continue                  |
| `cancelled`         | Client cancelled via `session/cancel`      |

The implementation uses `'complete'` (should be `'end_turn'`) and `'max_turns'` (should be `'max_turn_requests'`). It also uses `'error'` which is not a valid ACP `StopReason` at all.

### Verdict: CONFIRMED
3 of 4 values in the implementation's `stopReason` union are non-ACP:
- `'complete'` should be `'end_turn'`
- `'max_turns'` should be `'max_turn_requests'`
- `'error'` is not a valid ACP stop reason (ACP has no error stop reason — errors should be handled differently)

Only `'cancelled'` matches the ACP spec.

## Remediation
1. Change the type to use ACP values:
   ```typescript
   stopReason: 'end_turn' | 'max_turn_requests' | 'cancelled' | 'error';
   ```
2. Update all places returning `'complete'` to return `'end_turn'`.
3. Update all places returning `'max_turns'` to return `'max_turn_requests'`.
4. Consider handling `'error'` as a separate mechanism rather than a stop reason, since ACP does not define it as a valid `StopReason`. Alternatively, document it as an internal extension value that gets translated at the L2 ACP layer.
5. Consider adding `'max_tokens'` and `'refusal'` for full spec coverage.
