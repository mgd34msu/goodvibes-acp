# ISS-157: No `_meta` support on `ToolResult` responses

**Source**: `src/types/registry.ts` lines 29-40 (via `src/plugins/project/analyzer.ts`)
**KB Reference**: KB-08 (Extensibility)
**Severity**: Minor

## Issue Description
The `ToolResult<T>` type lacks a `_meta` field. Per KB-08, every protocol type should support `_meta` for extensibility.

### Verdict: PARTIAL

The `ToolResult<T>` type in `src/types/registry.ts` indeed lacks a `_meta` field. KB-08 states that "every type in the ACP protocol includes an optional `_meta` field." However, `ToolResult` is an internal execution envelope used by the plugin system (project analyzer, precision engine), not a wire protocol type sent over ACP transport. The ACP wire protocol uses `ToolCall` (which does have `_meta`) for tool communication.

The issue is partially valid: adding `_meta` would improve consistency and allow internal tooling to attach metadata, but it is not strictly an ACP protocol compliance violation since `ToolResult` is an internal type.

## Remediation
1. Add `_meta?: Record<string, unknown>` to the `ToolResult` type for consistency with KB-08 extensibility patterns
2. This is a low-priority enhancement rather than a compliance fix
