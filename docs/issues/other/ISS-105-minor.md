# ISS-105 — Missing agent_thought_chunk and config_options_update Emissions

**Severity**: Minor
**File**: src/extensions/acp/agent.ts:226-327
**KB Topic**: Prompt Turn

## Original Issue
Missing `agent_thought_chunk` and `config_options_update` emissions during prompt turns. Consider emitting `config_options_update` when mode/model changes during a turn. *(Prompt Turn)*

## Verification

### Source Code Check
The prompt handler in `src/extensions/acp/agent.ts` (lines 246-341) does not emit `agent_thought_chunk` or `config_options_update` notifications. It emits:
- `session_info` (via `sessionInfoUpdate`) at line 271
- `agent_message_chunk` at line 305
- `'finish'` (non-spec) at lines 318, 340

### ACP Spec Check
From `docs/acp-knowledgebase/04-prompt-turn.md`, the Update Type Reference:

| `sessionUpdate` value | When emitted |
|---|---|
| `agent_thought_chunk` | LLM internal thinking (extended thinking mode) |
| `config_options_update` | Agent-initiated config change (complete state) |

For `agent_thought_chunk`, the spec notes: "Internal reasoning/thinking from the LLM (extended thinking mode). Clients may display or suppress this." This is only relevant when the underlying LLM supports extended thinking.

For `config_options_update`, the spec notes: "Common reasons: mode switch after planning phase, model fallback on rate limits, adjusting available options based on runtime context." This is an optional, situational notification.

From `docs/acp-knowledgebase/03-sessions.md`: "Agent sends a `config_options_update` session notification" — described as an agent-initiated update, not a required one.

Neither `agent_thought_chunk` nor `config_options_update` are mandatory per the spec. The spec says "Optional — not all agents emit plans" for the `plan` update type; the same logic applies to thought chunks and config updates.

### Verdict: NOT_ACP_ISSUE
Neither `agent_thought_chunk` nor `config_options_update` are required emissions under the ACP spec. `agent_thought_chunk` only applies to agents using extended thinking mode LLMs (not applicable to the WRFC orchestrator pattern). `config_options_update` is an agent-initiated optional notification for runtime config changes — appropriate to add if mode/model changes during a turn, but not required.

The issue raises valid enhancement suggestions but they are not ACP compliance violations.

## Remediation
N/A for ACP compliance. For enhanced UX:
1. If mode or model changes occur during a WRFC turn, emit `config_options_update` to keep the client in sync:
   ```typescript
   await this.conn.sessionUpdate({
     sessionId,
     update: { sessionUpdate: 'config_options_update', configOptions: this.getConfigOptions() },
   });
   ```
2. `agent_thought_chunk` is only relevant if using a streaming LLM with extended thinking — not applicable to the current WRFC pattern.
