# ISS-093: No AbortSignal forwarding in stream()

**Severity**: Major
**File**: src/plugins/agents/providers/anthropic.ts
**Line(s)**: 50-87
**Topic**: Implementation Guide

## Issue Description
No `AbortSignal` forwarding in `stream()`. Same issue as #92.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 10-implementation-guide.md, section 5; KB 01-overview.md line 148
- **Spec Says**: Same as ISS-092. The `session/cancel` notification should abort ongoing processing, including streaming responses.
- **Confirmed**: Partial
- **Notes**: Streaming is even more critical for cancellation since it's a long-running operation. Without AbortSignal, cancelling a session/prompt while streaming will not stop the Anthropic API call, wasting tokens and time.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 50-51: `this.client.messages.stream({...})` — no `signal` option passed. The stream continues until completion regardless of cancellation.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `signal?: AbortSignal` to the `ChatParams` interface (same as ISS-092).
2. Pass `{ signal: params.signal }` as the second argument to `this.client.messages.stream()`.
3. Add abort handling in the `for await` loop to break cleanly on signal abort.
