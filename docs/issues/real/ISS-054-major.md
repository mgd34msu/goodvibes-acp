# ISS-054 — DirectiveAction Has No 'cancel' Action — Cancellation Cannot Be Propagated

**Severity**: Major
**File**: src/types/directive.ts:15
**KB Topic**: session/cancel (04-prompt-turn.md lines 466-494)

## Original Issue
`DirectiveAction` includes `'spawn' | 'complete' | 'escalate' | 'fix' | 'review'` but has no `'cancel'` action.

## Verification

### Source Code Check
Line 15 defines:
```typescript
export type DirectiveAction = 'spawn' | 'complete' | 'escalate' | 'fix' | 'review';
```
No `'cancel'` variant exists.

### ACP Spec Check
KB-04 (lines 466-494) specifies `session/cancel` protocol rules:
- "Agent SHOULD stop all LLM requests and tool invocations as soon as possible."
- "Agent MUST eventually respond to the original `session/prompt` request with `{ stopReason: 'cancelled' }`."
- "Agent MUST ensure all pending updates are sent BEFORE responding to `session/prompt`."

Cancellation is a first-class protocol operation. Without a `'cancel'` directive action, the directive queue (which is the runtime's mechanism for propagating instructions to agents/WRFC chains) has no way to signal cancellation.

### Verdict: CONFIRMED
The `DirectiveAction` type lacks a `'cancel'` variant. The runtime cannot propagate ACP cancellation signals through the directive queue, which is the primary mechanism for inter-agent communication.

## Remediation
1. Add `'cancel'` to the `DirectiveAction` union type:
   ```typescript
   export type DirectiveAction = 'spawn' | 'complete' | 'escalate' | 'fix' | 'review' | 'cancel';
   ```
2. Add a handler for `'cancel'` directives in the directive processor that:
   - Aborts in-progress LLM requests (via `AbortController`)
   - Stops pending tool invocations
   - Propagates `stopReason: 'cancelled'` back through the chain
3. Wire the `session/cancel` ACP handler to emit a `'cancel'` directive
