# ISS-023: AnalyticsEngine does not implement IToolProvider

**Severity**: Critical
**File**: src/plugins/analytics/engine.ts
**Line(s)**: 26-207 (entire class)
**Topic**: Extensibility

## Issue Description
`AnalyticsEngine` does not implement `IToolProvider`. No `name`, `tools`, or `execute()`. Cannot be dispatched through the ACP tool system.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 08-extensibility.md lines 80-99, 189-197
- **Spec Says**: ACP defines extension methods (`_goodvibes/analytics`) for querying budget/token usage. The spec expects these to be accessible via `extMethod` or `extNotification` on the Agent interface. The spec does NOT specifically require an `IToolProvider` interface -- that is an internal architectural pattern.
- **Confirmed**: Partial
- **Notes**: The ACP spec defines `_goodvibes/analytics` as a planned extension method (KB 08, line 197). The issue is real -- analytics functionality is unreachable via ACP -- but `IToolProvider` is an internal interface, not an ACP spec requirement. The actual ACP conformance issue is that `_goodvibes/analytics` extension method is not wired up.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `AnalyticsEngine` is a standalone class with methods like `track()`, `getBudget()`, `getDashboard()`, etc. It has no `name` property, no `tools` getter, and no `execute()` method. It also has no `extMethod` handler registration.
- **Issue Confirmed**: Yes (the class is unreachable via ACP)

## Verdict
PARTIAL

## Remediation Steps
1. Either implement `IToolProvider` interface on `AnalyticsEngine` (for tool-based access) OR wire up `_goodvibes/analytics` extension method handler in the agent's `extMethod()` implementation
2. Register the handler so it's discoverable via the ACP connection
