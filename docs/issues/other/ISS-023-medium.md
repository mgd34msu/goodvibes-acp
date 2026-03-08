# ISS-023: Fire-and-forget tool_call lifecycle breaks on partial failure

**Source**: `src/extensions/mcp/tool-call-bridge.ts` (lines 91-113)
**KB Reference**: KB-06: Tool Call Lifecycle
**Severity**: Medium

### Verdict: NOT_ACP_ISSUE

**Finding**: The code chains `emitToolCall()` with `.then(() => emitToolCallUpdate(..., 'in_progress'))` and a shared `.catch()`. If `emitToolCall` (pending announcement) fails, the `.then()` block would not execute (standard Promise behavior), but the `.catch()` only logs the error — the tool continues executing without any announced lifecycle.

This is a real code quality bug: if the initial `tool_call` emission fails, the tool still runs and later emits `completed`/`failed` updates for a tool_call the client never saw. However, this is an internal error-handling issue, not an ACP protocol compliance violation.

Note: The code correctly uses `'in_progress'` which matches the SDK's `ToolCallStatus` type (`'pending' | 'in_progress' | 'completed' | 'failed'`), even though KB-06 documentation uses `'running'`. The SDK is authoritative.

### Remediation

Not required for ACP compliance. For code quality:

1. Use `async/await` instead of `.then()` chains
2. If `emitToolCall` fails, skip subsequent lifecycle updates or retry
3. Track announcement state so `tool_complete` handler knows whether to emit updates
