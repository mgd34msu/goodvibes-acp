# ISS-158 — Tool Call Status `in_progress` vs `running` Discrepancy

**Severity**: Minor
**File**: `src/extensions/mcp/tool-call-bridge.ts:27-29`
**KB Topic**: Tools & MCP

## Original Issue
Comment says `status: in_progress` but KB uses `running` (SDK may use `in_progress` — KB is stale here). Resolve the discrepancy.

## Verification

### Source Code Check
Lines 27-29 of `src/extensions/mcp/tool-call-bridge.ts` (JSDoc comment):
```typescript
 *   tool_start  → tool_call      (status: in_progress)
 *   tool_complete → tool_call_update (status: completed)
 *   tool_error    → tool_call_update (status: failed)
```

Line 82 (actual implementation):
```typescript
emitter.emitToolCall(
  sessionId,
  toolCallId,
  event.toolName,
  title,
  'in_progress',   // <-- actual value used
  { '_goodvibes/turn': event.turn },
)
```

The code uses `'in_progress'` in both the comment and the implementation.

### ACP Spec Check
There are two conflicting definitions in the KB:

**KB `06-tools-mcp.md` (line 114):**
```typescript
type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';
```
Status lifecycle: `pending → running → completed | failed`

**KB `04-prompt-turn.md` (line 207):**
```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";
```
Status lifecycle: `pending → in_progress → completed | cancelled | error`

The two KB files define entirely different status vocabularies. `06-tools-mcp.md` uses `running` and `failed`; `04-prompt-turn.md` uses `in_progress` and `error`/`cancelled`. The implementation uses `in_progress` (matching `04-prompt-turn.md`) and `completed`/`failed` (mixing both). This is a genuine ambiguity — the KB itself is internally inconsistent.

### Verdict: PARTIAL
The issue is real but incorrectly characterized. The comment accurately matches the actual implementation (`in_progress`). The true problem is that the two authoritative KB files define contradictory status enums. The implementation should defer to the official ACP wire format spec (from `https://agentclientprotocol.com/llms-full.txt`) to resolve which values are canonical. As written, the implementation is partially compliant with one KB document and non-compliant with the other.

## Remediation
1. Fetch the canonical ACP spec from `https://agentclientprotocol.com/llms-full.txt` and identify the single authoritative `ToolCallStatus` definition.
2. Update `tool-call-bridge.ts` to use the canonical status values throughout (both the JSDoc comment and the `emitToolCall`/`emitToolCallUpdate` calls).
3. Update whichever KB file is incorrect to match the canonical spec.
4. If the canonical spec uses `running`, change `'in_progress'` → `'running'` and `'failed'` stays (or update to `'error'` if needed).
