# ISS-139 — Shutdown Handler References `mcpBridge` Before Declaration

**Severity**: Minor
**File**: src/main.ts
**KB Topic**: Implementation Guide

## Original Issue
Shutdown handler references `mcpBridge` declared 40 lines later. Works via lazy closure but creates fragile ordering dependency. Move shutdown registrations after all service instantiations.

## Verification

### Source Code Check
At line 117 of `src/main.ts`:
```typescript
shutdownManager.register('mcp-bridge', 20, () => mcpBridge.disconnectAll());
```
Via grep, `mcpBridge` is declared at line 161 of `src/main.ts`. The shutdown handler is registered 44 lines before `mcpBridge` is declared. This works because the closure `() => mcpBridge.disconnectAll()` captures the variable binding, not the value — by the time shutdown runs, `mcpBridge` will have been assigned. However, if shutdown were triggered before line 161 (e.g., during startup failure), `mcpBridge` would be `undefined` and `mcpBridge.disconnectAll()` would throw a `ReferenceError` or `TypeError`.

### ACP Spec Check
The ACP implementation guide (KB `10-implementation-guide.md`) emphasizes correct lifecycle ordering. A startup failure mid-initialization that triggers shutdown would cause the shutdown handler to fail, potentially masking the original error or leaving resources in an inconsistent state. This is not an ACP wire protocol compliance issue, but is an implementation lifecycle issue.

### Verdict: NOT_ACP_ISSUE
The issue is real and correctly described — the shutdown handler for `mcpBridge` references a variable not yet declared at the point of registration. While it works in practice due to lazy closure semantics, it is a fragile ordering dependency. This is a code quality/lifecycle issue, not an ACP compliance issue.

## Remediation
Move all shutdown handler registrations to after the final service instantiation in `main.ts`:
```typescript
// After all services and plugins are instantiated:
shutdownManager.register('memory', 10, () => memoryManager.save());
shutdownManager.register('mcp-bridge', 20, () => mcpBridge.disconnectAll());
shutdownManager.register('service-registry', 30, () => serviceRegistry.save());
shutdownManager.register('ipc-socket', 40, () => ipcSocketServer.stop());
shutdownManager.register('daemon', 50, () => daemonManager.stop());
shutdownManager.register('hooks', 90, async () => { hookEngine.destroy(); });
```
Or add a null guard in the handler:
```typescript
shutdownManager.register('mcp-bridge', 20, () => mcpBridge?.disconnectAll());
```
