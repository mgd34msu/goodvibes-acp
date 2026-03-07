# ISS-078: PrecisionPlugin execute() has no tool_call status emission hook

**Severity**: Major
**File**: src/plugins/precision/index.ts
**Line(s)**: 434
**Topic**: Implementation Guide

## Issue Description
`execute()` provides no mechanism for L2 ACP layer to emit `pending -> running -> completed` updates. Needs `onStatus` callback.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/10-implementation-guide.md, Section 6 (WRFC as Tool Calls)
- **Spec Says**: Every tool invocation must emit the ACP `tool_call` status lifecycle: `pending` (announced), then `running` (executing), then `completed`/`failed` (finished). The implementation guide shows explicit `sessionUpdate` calls for each status transition with `_meta` payloads.
- **Confirmed**: Yes
- **Notes**: Without an `onStatus` callback or event emission, the L2 ACP layer has no way to know when a precision tool starts or finishes, making it impossible to emit the required `tool_call` / `tool_call_update` notifications.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: The `execute()` method (line 434+) is a simple switch-case dispatch to individual tool implementations. It records `startMs` for duration tracking but has no callback parameter, no event emission, and no hook point for external observers. The method signature is `execute<T>(toolName: string, params: unknown): Promise<ToolResult<T>>` with no `onStatus` or lifecycle callback.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add an optional `onStatus` callback parameter: `execute<T>(toolName: string, params: unknown, onStatus?: (status: ToolCallStatus) => void)`
2. Call `onStatus('pending')` before dispatch, `onStatus('running')` at execution start, `onStatus('completed'|'failed')` after
3. Alternatively, emit events via the EventBus (`tool:pending`, `tool:running`, `tool:completed`) that the L2 ACP layer subscribes to
4. Ensure the L2 layer maps these status transitions to ACP `tool_call` / `tool_call_update` session notifications
