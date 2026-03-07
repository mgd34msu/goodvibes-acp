# ISS-137 — Shutdown Handlers Missing L3 Plugin Teardown

**Severity**: Minor
**File**: src/main.ts
**KB Topic**: Implementation Guide

## Original Issue
Shutdown handlers don't include L3 plugin teardown. Spec implies L3 → L2 → L1 shutdown order. L3 plugins have no shutdown handlers. Register with lower priorities (5–9).

## Verification

### Source Code Check
The shutdown registrations in `src/main.ts` (lines 113-120) are:
```typescript
shutdownManager.register('memory', 10, () => memoryManager.save());
shutdownManager.register('hooks', 90, async () => { hookEngine.destroy(); });
shutdownManager.register('mcp-bridge', 20, () => mcpBridge.disconnectAll());
shutdownManager.register('service-registry', 30, () => serviceRegistry.save());
shutdownManager.register('ipc-socket', 40, () => ipcSocketServer.stop());
shutdownManager.register('daemon', 50, () => daemonManager.stop());
```
L3 plugins registered in the same file (`ReviewPlugin`, `AgentsPlugin`, `SkillsPlugin`, `PrecisionPlugin`, `AnalyticsPlugin`, `ProjectPlugin`, `FrontendPlugin`) have no corresponding shutdown handlers. These plugins may hold open resources (file handles, network connections, worker threads) that are not torn down.

### ACP Spec Check
The ACP implementation guide (KB `10-implementation-guide.md`) describes a layered architecture (L1/L2/L3) and implies shutdown should be ordered from highest layer to lowest (L3 plugins first, then L2 extensions, then L1 primitives) to allow clean resource release. The absence of L3 shutdown hooks could leave resources uncleaned.

This is an implementation guide concern, not a core ACP wire protocol compliance issue.

### Verdict: PARTIAL
The issue correctly identifies that L3 plugins have no shutdown handlers. The current shutdown sequence only covers L2 services (memory, hooks, MCP bridge, service registry, IPC socket, daemon). L3 plugins that hold resources (e.g., open file handles in analytics, active MCP connections) are not explicitly torn down. However, this is an implementation quality concern rather than a strict ACP protocol violation.

## Remediation
1. Audit each L3 plugin for resources that need explicit teardown.
2. Add shutdown handlers with priorities in the 5–9 range (before L2 teardown at 10–90):
```typescript
// L3 plugin teardown (priority < 10 = before L2 services)
shutdownManager.register('analytics-plugin', 5, () => analyticsPlugin.destroy?.());
shutdownManager.register('project-plugin', 6, () => projectPlugin.destroy?.());
shutdownManager.register('frontend-plugin', 7, () => frontendPlugin.destroy?.());
```
3. Add optional `destroy(): Promise<void>` method to plugin interfaces that need it.
4. Move shutdown registrations to after all plugin instantiations (also addresses issue #139).
