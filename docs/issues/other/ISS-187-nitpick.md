# ISS-187 — Shutdown Handler References `mcpBridge` Before Its Declaration

**Severity**: Nitpick
**File**: `src/main.ts:99`
**KB Topic**: Implementation Guide

## Original Issue
`[src/main.ts:99]` Shutdown handler references `mcpBridge` 40 lines before its declaration. Works via lazy closure but fragile. (Also noted as minor #139.) *(Implementation Guide)*

## Verification

### Source Code Check
From the outline of `src/main.ts`:
- `mcpBridge` is declared at **line 161**: `mcpBridge = new McpBridge(eventBus)`
- `shutdownManager.register('mcp-bridge', 20, () => mcpBridge.disconnectAll())` appears at approximately **line 117**

The shutdown handler is a lambda `() => mcpBridge.disconnectAll()`. In JavaScript/TypeScript, `const` declarations are not hoisted in the same way — accessing a `const` before its declaration throws a `ReferenceError` at runtime. However, because the lambda is only *called* later (during shutdown), not at the point of registration, the closure captures the binding and resolves `mcpBridge` at call time (line 161 has already executed by then). The issue correctly identifies this as working via lazy closure.

The fragility: if the shutdown handler is ever invoked before `mcpBridge` is initialized (e.g., early-exit path), a `ReferenceError` will occur. Additionally, the code is harder to read because the dependency order is non-obvious.

### ACP Spec Check
The ACP Implementation Guide (KB 10) shows a clean sequential initialization pattern: create connections, register handlers, then start. It does not address shutdown handler ordering or forward closure references. This is a code organization and robustness concern, not a protocol compliance matter.

### Verdict: NOT_ACP_ISSUE
The issue is real — the code does reference `mcpBridge` in a closure registered 44 lines before `mcpBridge` is declared. It works as described due to lazy closure semantics. However, this is a code organization issue with no ACP compliance dimension. Also noted as minor #139 (indicating it was already captured at higher severity).

## Remediation
N/A — not an ACP compliance issue.

For code quality: move all `shutdownManager.register()` calls to after all variables they reference are declared, or extract a dedicated `registerShutdownHandlers()` function called after all initialization.
