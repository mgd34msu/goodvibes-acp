# ISS-104 — Error Path Returns 'end_turn' Instead of Appropriate stopReason

**Severity**: Major
**File**: src/extensions/acp/agent.ts:302-323
**KB Topic**: Prompt Turn

## Original Issue
On error, prompt handler returns `{ stopReason: 'end_turn' }` instead of `'refusal'`. Spec defines `'refusal'` for "Agent refuses to continue." *(Prompt Turn)*

## Verification

### Source Code Check
`src/extensions/acp/agent.ts` catch block (lines 322-341):
```typescript
} catch (err) {
  if (controller.signal.aborted) {
    await this.conn.sessionUpdate({ ... update: { sessionUpdate: 'finish', stopReason: 'cancelled' } as any }).catch(() => {});
    return { stopReason: 'cancelled' };
  }

  // Stream error to client
  const acpErr = toAcpError(err);
  await this.conn.sessionUpdate({
    sessionId,
    update: messageChunkUpdate('agent_message_chunk', { type: 'text', text: `Error: ${acpErr.message}` }),
  }).catch(() => {});

  await this.conn.sessionUpdate({
    sessionId,
    update: { sessionUpdate: 'finish', stopReason: 'end_turn' } as any,
  });

  return { stopReason: 'end_turn' };
}
```

On non-abort errors, the code returns `stopReason: 'end_turn'` rather than another stop reason.

### ACP Spec Check
From `docs/acp-knowledgebase/04-prompt-turn.md`:
```typescript
type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
```

Stop reason definitions:
| Value | Meaning |
|---|---|
| `end_turn` | LLM finished without requesting more tools |
| `max_tokens` | Maximum token limit reached |
| `max_turn_requests` | Maximum model requests per turn exceeded |
| `refusal` | Agent refuses to continue |
| `cancelled` | Client cancelled via `session/cancel` |

The spec also notes: "Implementation note: API client libraries often throw an exception when aborted. Agents MUST catch these and return `cancelled`."

### Verdict: PARTIAL
The issue has merit but the claim that `'refusal'` is the correct stop reason for errors is overstated. The ACP spec defines `refusal` as "Agent refuses to continue" — this implies a deliberate decision by the agent (e.g., content policy), not an unexpected runtime error.

For unexpected errors there is no defined `error` stop reason in the spec, so `end_turn` is a reasonable fallback. However, returning `end_turn` implies the LLM finished normally — which is misleading when an exception occurred. A more honest mapping would be to:
- Use `refusal` only when the agent deliberately refuses (e.g., safety policy rejection).
- Use `end_turn` for unexpected errors as a pragmatic fallback (current behavior), while streaming the error detail as an `agent_message_chunk` first (which the code already does).

The deeper real problem in this issue is the `as any` `'finish'` update emitted on the error path (covered by ISS-103), not the stop reason value itself.

## Remediation
1. Keep `end_turn` for generic unhandled errors (no spec-defined alternative).
2. If the agent has deliberate refusal logic (e.g., policy rejection), use `refusal` in those specific code paths — not as a blanket catch-all.
3. Remove the `'finish'` sessionUpdate emission from the error path (per ISS-103).
4. Consider adding error categorization:
   ```typescript
   function toStopReason(err: unknown): StopReason {
     if (isRefusalError(err)) return 'refusal';
     return 'end_turn';
   }
   ```
