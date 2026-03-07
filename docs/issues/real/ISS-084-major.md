# ISS-084: Error condition returns stopReason end_turn instead of distinguishing errors

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**Line(s)**: 335-340
**Topic**: Prompt Turn

## Issue Description
Error condition returns `stopReason: 'end_turn'` instead of distinguishing errors from normal completion. Map error types to `'refusal'` or propagate as JSON-RPC errors.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/04-prompt-turn.md lines 61-67
- **Spec Says**: `StopReason` is a union of `"end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled"`. `end_turn` means "LLM finished without requesting more tools". `refusal` means "Agent refuses to continue". Errors should be propagated as JSON-RPC error responses per the JSON-RPC 2.0 spec, not disguised as successful completions.
- **Confirmed**: Yes
- **Notes**: Using `end_turn` for errors makes it impossible for clients to distinguish normal completion from error conditions.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 335-340 handle the error catch block. After streaming an error message to the client (line 335: `Error: ${acpErr.message}`), the code sends a finish update with `stopReason: 'end_turn'` (line 340) and returns `{ stopReason: 'end_turn' }` (line 343). This conflates errors with normal turn completion.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. For agent-side errors (internal failures), return a JSON-RPC error response instead of a successful response with `end_turn`
2. For content policy / refusal errors, use `stopReason: 'refusal'`
3. For token limit errors, use `stopReason: 'max_tokens'`
4. Reserve `end_turn` exclusively for normal LLM completion
