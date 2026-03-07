# ISS-025: Zero ACP extension method integration across all plugins

**Severity**: Critical
**File**: All plugin files (src/plugins/)
**Line(s)**: N/A (architectural gap)
**Topic**: Extensibility

## Issue Description
Zero ACP extension method integration. No `handleExtMethod()`, no `onExtNotification()`, no `_goodvibes/`-prefixed methods handled or emitted. Spec defines `_goodvibes/analytics` and `_goodvibes/events` -- neither implemented.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 08-extensibility.md lines 80-99, 141-181, 189-198
- **Spec Says**: The ACP SDK `Agent` interface includes optional `extMethod?(method, params)` and `extNotification?(method, params)` methods. The KB defines planned extension methods including `_goodvibes/status`, `_goodvibes/state`, `_goodvibes/events`, `_goodvibes/agents`, `_goodvibes/analytics`, and `_goodvibes/directive`. These use standard JSON-RPC 2.0 semantics with `_`-prefixed method names.
- **Confirmed**: Yes
- **Notes**: The SDK TypeScript Agent interface (KB 09, lines 480-481) explicitly defines `extMethod?` and `extNotification?` as optional methods. These are the hook points for extension methods.

### Source Code Check
- **Code Exists**: No (the extension method handlers do not exist)
- **Code Shows**: The agent class in `src/extensions/acp/agent.ts` does not implement `extMethod()` or `extNotification()`. No plugin registers extension method handlers. The `_goodvibes/` namespace is defined in KB but has zero runtime implementation.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Implement `extMethod()` on the agent class to dispatch `_goodvibes/*` requests to appropriate handlers
2. Implement `extNotification()` for fire-and-forget extension notifications
3. Wire up at minimum: `_goodvibes/analytics` (to AnalyticsEngine), `_goodvibes/agents` (to agent tracker), `_goodvibes/status` (to WRFC orchestrator)
4. Add `_goodvibes/events` notification emission from the event bus
