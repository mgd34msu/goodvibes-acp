# ISS-162 — Sequential Tool Execution Contradicts "Parallel Order" Comment

**Severity**: Minor
**File**: src/plugins/agents/loop.ts:175-237
**KB Topic**: Implementation Guide

## Original Issue
**[src/plugins/agents/loop.ts:175-237]** Sequential tool execution contradicts "parallel order" comment. Refer to issue #80 for context; this is the minor form noted separately in W2. *(Implementation Guide)*

## Verification

### Source Code Check
Line 173 comment says:
```typescript
/** Execute all tool_use blocks in parallel order, return tool_result blocks */
private async _executeToolCalls(
  content: ContentBlock[],
  turn: number,
): Promise<ContentBlock[]> {
```
But the implementation uses a sequential `for...of` loop with `await`:
```typescript
for (const block of toolUseBlocks) {
  const startTime = Date.now();
  // ...
  const result = await provider.execute(toolName, block.input);
  // ...
}
```
The comment says "parallel order" but the code runs tools sequentially, awaiting each before starting the next.

### ACP Spec Check
The ACP specification does not mandate that tool calls within a single LLM response be executed in parallel. The spec defines the notification protocol for tool call status (`tool_call`, `tool_call_update`) but leaves execution order to the agent implementation. Parallel execution would be an optimization, not a protocol requirement.

### Verdict: NOT_ACP_ISSUE
The discrepancy between the comment and implementation is a real code quality issue — the comment is misleading. However, the ACP spec places no requirement on whether tool calls are executed sequentially or in parallel. This is an internal implementation detail, not an ACP compliance violation.

## Remediation
N/A — Not an ACP compliance issue.

For code quality improvement (optional):
- Update the comment to "Execute all tool_use blocks sequentially, return tool_result blocks"
- Or replace the `for...of` with `Promise.all(toolUseBlocks.map(...))` to actually implement parallel execution
