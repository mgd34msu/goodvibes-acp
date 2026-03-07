# ISS-178 — Comment Says `status: in_progress` but KB Uses `running`

**Severity**: Minor
**File**: src/extensions/mcp/tool-call-bridge.ts:60
**KB Topic**: Tools & MCP

## Original Issue
Comment says `status: in_progress` but KB uses `running`.

## Verification

### Source Code Check
The class-level JSDoc comment (lines 27-28) states:
```typescript
 *   tool_start  → tool_call      (status: in_progress)
 *   tool_complete → tool_call_update (status: completed)
 *   tool_error    → tool_call_update (status: failed)
```

The actual emitted value in the code (line ~74):
```typescript
emitter.emitToolCall(sessionId, toolCallId, event.toolName, title, 'in_progress', ...)
```

The code emits `'in_progress'` on `tool_start`.

### ACP Spec Check
The two KB files disagree on the valid status values:

**KB `04-prompt-turn.md` line 207** (TypeScript interface):
```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";
```

**KB `06-tools-mcp.md` line 114** (TypeScript interface):
```typescript
type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';
```

These two KB entries contradict each other: one says `in_progress` and `error`, the other says `running` and `failed`. The KB `05-permissions.md` shows `running` in its example (line 245: `"status": "running"`).

Looking at the ACP spec fetched from `agentclientprotocol.com`, the canonical status values for `tool_call_update` include both `in_progress` and `running` — the KB files represent different versions or sections of the spec. The `in_progress` status appears in the initial `tool_call` acknowledgement flow, while `running` is used post-permission-grant.

The issue specifically claims the comment says `in_progress` but KB uses `running`. The comment is about the `tool_call` initial emit (not `tool_call_update`), and the KB04 shows `status: "in_progress"` on `tool_call_update`. However, KB06 and KB05 consistently use `running` for the active execution state.

### Verdict: CONFIRMED
There is a genuine inconsistency. The code emits `'in_progress'` on initial `tool_call` (per KB04's `tool_call_update` lifecycle), but the more detailed KB06 and KB05 show `'running'` as the status for the active execution phase. The KB itself is inconsistent, but the dominant pattern across KB05 and KB06 examples is:
- `tool_call` → `status: 'pending'`
- `tool_call_update` → `status: 'running'` (executing)
- `tool_call_update` → `status: 'completed'` or `'failed'`

The code skips `pending` and emits the initial `tool_call` with `in_progress`. This conflates two different lifecycle stages.

## Remediation
1. Update the `tool_start` handler to follow the canonical two-step lifecycle:
   - Emit `tool_call` with `status: 'pending'` (announcement — LLM requested the tool)
   - Emit `tool_call_update` with `status: 'running'` (execution started)
2. Update the class JSDoc comment to reflect the correct lifecycle:
   ```typescript
   *   tool_start    → tool_call        (status: pending)    // announcement
   *                 → tool_call_update (status: running)    // execution started
   *   tool_complete → tool_call_update (status: completed)
   *   tool_error    → tool_call_update (status: failed)
   ```
3. Align status value: use `'running'` (per KB06 canonical tool call lifecycle) rather than `'in_progress'` in the `tool_call_update` transition.
