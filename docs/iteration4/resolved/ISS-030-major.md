# ISS-030 — ToolResult lacks `_meta` field

**Severity**: Major
**File**: `src/types/registry.ts`
**Lines**: 29-40
**KB Reference**: KB-08 (Extensibility)

## Description

KB-08 states that `_meta` is available on "every type in the ACP protocol" including nested types like tool calls. The `ToolResult` type definition does not include a `_meta` field:

```typescript
export type ToolResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  errorDetail?: Record<string, unknown>;
  durationMs?: number;
};
```

This prevents attaching trace context, telemetry identifiers, or other extensibility metadata to tool results, which is needed for cross-system observability.

### Verdict: CONFIRMED

The `ToolResult` type at lines 29-40 has no `_meta` field. KB-08 lines 16, 26 explicitly require `_meta` on all protocol types including nested types like tool calls. `ToolResult` is used in ACP tool call responses, making it a protocol-facing type.

## Remediation

1. Add `_meta?: Record<string, unknown>` to the `ToolResult` type
2. Forward `_meta` from MCP tool results to ACP tool call updates where applicable
3. Consider also adding `_meta` to `ToolDefinition` and `WorkResult` for consistency
