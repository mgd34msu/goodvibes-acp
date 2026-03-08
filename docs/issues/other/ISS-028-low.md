# ISS-028: Non-standard type discriminant field breaks JSON-RPC 2.0 compliance

**Source**: `src/extensions/ipc/protocol.ts` (lines 34-35)
**KB Reference**: KB-01: JSON-RPC 2.0
**Severity**: Low

### Verdict: NOT_ACP_ISSUE

**Finding**: The `IpcMessage` interface includes a `type: string` discriminant field not present in JSON-RPC 2.0. The `deserializeMessage` function validates `type` as required, meaning it would reject valid JSON-RPC 2.0 messages that lack this field.

However, examining the code, this IPC protocol is an **internal** communication layer (used for inter-process communication within the GoodVibes system), not the ACP wire protocol. The ACP protocol runs over stdio using standard JSON-RPC 2.0 (handled by `src/extensions/mcp/transport.ts`). The IPC socket layer is a separate internal transport.

KB-01 defines JSON-RPC 2.0 compliance for ACP messages between agent and client. Internal IPC between daemon components is not governed by the ACP specification.

### Remediation

Not required for ACP compliance. For code quality:

1. Add a comment clarifying this is an internal protocol, not ACP JSON-RPC 2.0
2. Consider renaming from `IpcMessage` to `InternalIpcMessage` to avoid confusion
