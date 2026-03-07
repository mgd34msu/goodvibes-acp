# ISS-103 — Emits Non-Spec 'finish' sessionUpdate Type

**Severity**: Major
**File**: src/extensions/acp/agent.ts:267-272, 296-299, 304-308, 318-321
**KB Topic**: Prompt Turn

## Original Issue
Code emits a `'finish'` `sessionUpdate` not defined in spec. Turn ends when `session/prompt` response is returned with `stopReason`. Remove `'finish'` emissions. *(Prompt Turn)*

## Verification

### Source Code Check
Four occurrences of the `'finish'` sessionUpdate in `src/extensions/acp/agent.ts`:

Line 290:
```typescript
update: { sessionUpdate: 'finish', stopReason: 'cancelled' } as any,
```

Line 318:
```typescript
update: { sessionUpdate: 'finish', stopReason: 'end_turn' } as any,
```

Line 326:
```typescript
update: { sessionUpdate: 'finish', stopReason: 'cancelled' } as any,
```

Line 340:
```typescript
update: { sessionUpdate: 'finish', stopReason: 'end_turn' } as any,
```

All four use `as any` — a TypeScript escape hatch indicating the author knew this didn't match the SDK types.

### ACP Spec Check
From `docs/acp-knowledgebase/04-prompt-turn.md`, the complete set of valid `sessionUpdate` discriminant values is:
- `agent_message_chunk`
- `agent_thought_chunk`
- `tool_call`
- `tool_call_update`
- `plan`
- `session_info`
- `available_commands`
- `config_options_update`
- `current_mode_update`
- `user_message_chunk`

`'finish'` is not in this list. The spec states: "The response [to session/prompt] is sent ONLY when the turn is fully complete." The `stopReason` belongs exclusively in the `session/prompt` JSON-RPC response, not in a `session/update` notification.

The spec's Update Type Reference table has no `finish` entry.

### Verdict: CONFIRMED
The code emits an entirely non-standard `sessionUpdate: 'finish'` notification type before returning the `session/prompt` response. This type does not exist in the ACP spec. The use of `as any` confirms TypeScript's own type checker rejected this. Clients implementing ACP will not know how to handle a `'finish'` update and will either silently discard it or error. The `stopReason` information is already correctly conveyed in the return value of `prompt()` (the `session/prompt` response) — the pre-emptive notification is redundant and non-compliant.

## Remediation
1. Remove all four `sessionUpdate: 'finish'` emissions from `src/extensions/acp/agent.ts`.
2. The `stopReason` is correctly communicated in the method's return value (`return { stopReason: 'end_turn' }` etc.) — that is the only place it needs to appear per spec.
3. If signaling "work started/completed" to the client is desired, use `session_info` updates instead:
   ```typescript
   await this.conn.sessionUpdate({
     sessionId,
     update: { sessionUpdate: 'session_info', content: { type: 'text', text: 'Turn complete.' } },
   });
   ```
