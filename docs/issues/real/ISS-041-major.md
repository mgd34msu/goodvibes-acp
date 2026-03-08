# ISS-041: No tool call lifecycle updates emitted by project plugin

**Severity**: Major  
**File**: `src/plugins/project/analyzer.ts`  
**Lines**: 239-256  
**KB Reference**: KB-06 (Tool Calls)

## Description

The `ProjectAnalyzer.execute()` method dispatches tool calls and returns results without emitting any `tool_call` or `tool_call_update` session updates. Per KB-06, tool calls should follow the lifecycle: pending -> running -> completed|failed, with corresponding `session/update` notifications so ACP clients can display progress.

## Source Evidence

The `execute()` method (line 239) simply calls `this._dispatch(toolName, params)` and wraps the result in a `ToolResult<T>` object. No `tool_call` or `tool_call_update` events are emitted at any point during execution.

## KB-06 Requirement

Tool calls must emit lifecycle updates:
- `tool_call` with status `pending` when the tool is requested
- `tool_call_update` with status `running` when execution begins
- `tool_call_update` with status `completed` or `failed` when done

### Verdict: CONFIRMED

The `execute()` method performs no ACP tool call lifecycle emissions. This is a genuine compliance gap.

## Remediation

Either:
1. Emit `tool_call` and `tool_call_update` events within `execute()` by accepting an EventBus or session connection reference, OR
2. Document that tool call lifecycle management is the caller's responsibility and ensure all callers emit the required updates.

Option 2 is the lower-risk approach if the project plugin is always invoked through a higher-level layer that already manages tool call lifecycle.
