# ISS-028 — IpcResponse does not extend IpcMessage — no `_meta` support

**Severity**: Major
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 52-62
**KB Reference**: KB-08 (Extensibility)

## Description

`IpcResponse` is defined as a standalone interface that duplicates `jsonrpc` and `type` fields from `IpcMessage` but does not extend it. This means `IpcResponse` lacks the `_meta` field that `IpcMessage` provides (line 39). The duplication also creates a maintenance burden — any changes to the base type must be replicated.

### Verdict: PARTIAL

The structural issue is real — `IpcResponse` duplicates fields and misses `_meta`. However, KB-08's `_meta` requirement applies to ACP protocol types, and IPC is an internal protocol. The missing `_meta` on IPC responses is a code quality issue and potential extensibility limitation, but not a direct ACP compliance violation.

## Remediation

1. Have `IpcResponse` extend `IpcMessage` (using `Omit<IpcMessage, 'id'>` with `id: string | null` override if needed)
2. This automatically provides `_meta` support on responses
3. Remove the duplicated `jsonrpc` and `type` field declarations
