# ISS-071 — `tool:execute` Post-Hook Is Empty — `tool_call_update` Never Emitted

**Severity**: Minor
**File**: src/extensions/hooks/registrar.ts:123-130
**KB Topic**: Overview — session/update notifications (tool_call_update) (01-overview.md lines 166, 208)

## Original Issue
The `tool:execute` post-hook is a TODO placeholder with an empty async body. `tool_call_update` notifications are never emitted from this hook.

## Verification

### Source Code Check
Lines 123-130 of `src/extensions/hooks/registrar.ts` confirm the issue:

```typescript
engine.register(
  'tool:execute',
  'post',
  async (_context: Record<string, unknown>, _result: unknown) => {
    // TODO: Emit tool_call_update with completion status
  },
  100
);
```

The hook body is completely empty except for a TODO comment. It is registered in the pipeline but performs no work.

### ACP Spec Check
KB-01 (01-overview.md line 208) lists `tool_call_update` as a `session/update` notification type: "Update an existing tool call's status/output". KB-06 (06-tools-mcp.md line 55) documents the full `tool_call_update` schema including `toolCallId`, `status`, and optional `output` fields. KB-05 (05-permissions.md line 196) states: "Agent reports tool_call_update (status: 'completed'|'failed') with result content" as step 6 of the tool execution flow.

The spec expects agents to emit `tool_call_update` after tool execution to report completion or failure status.

### Verdict: CONFIRMED
The code registers a `tool:execute` post-hook that is explicitly a TODO placeholder with an empty body. The ACP spec defines `tool_call_update` as the mechanism for reporting tool completion status, and this hook was clearly intended to emit those notifications but was never implemented. The hook consumes a pipeline slot without providing any value.

## Remediation
1. Implement the post-hook body to emit a `session/update` notification with `type: 'tool_call_update'`
2. Extract `toolCallId` from the hook context and `status` from the result
3. Include `output` content when the tool produces output
4. Handle both success (`status: 'completed'`) and failure (`status: 'failed'`) cases
5. Remove the TODO comment once implemented
