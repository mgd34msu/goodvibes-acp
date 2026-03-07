# ISS-092: No AbortSignal forwarding to Anthropic API in chat()

**Severity**: Major
**File**: src/plugins/agents/providers/anthropic.ts
**Line(s)**: 30-38
**Topic**: Implementation Guide

## Issue Description
No `AbortSignal` forwarding to Anthropic API in `chat()`. Cancellation flow broken.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 10-implementation-guide.md, section 5 (Prompt Handling); KB 01-overview.md line 148
- **Spec Says**: The implementation guide shows an `AbortController` pattern where `ctx.cancelController = controller` is set per prompt, and `controller.signal` is passed to the work function. ACP supports `session/cancel` notifications which should abort ongoing work.
- **Confirmed**: Partial
- **Notes**: The ACP spec itself doesn't mandate how cancellation is implemented internally, but the implementation guide pattern shows AbortSignal should flow through to the LLM provider. Without it, `session/cancel` cannot stop an in-flight API call.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 30-38: `this.client.messages.create({...})` — no `signal` option passed. The Anthropic SDK's `create()` method accepts an `options` second parameter with `{ signal: AbortSignal }`, but it is not used here. The `ChatParams` type likely doesn't include a signal field either.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `signal?: AbortSignal` to the `ChatParams` interface.
2. Pass `{ signal: params.signal }` as the second argument to `this.client.messages.create()`.
3. Ensure the agent's `prompt()` method passes `controller.signal` through to the provider.
