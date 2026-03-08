# ISS-037 — AgentsPlugin Registration Missing onProgressFactory — WRFC Progress Invisible

**Severity**: Major
**File**: src/plugins/agents/index.ts:32
**KB Topic**: Implementation Guide — WRFC as Tool Calls (10-implementation-guide.md section 6)

## Original Issue
Plugin registration creates `AgentSpawnerPlugin` without the `onProgressFactory` parameter. Agents spawned through the standard plugin path will never emit progress events.

## Verification

### Source Code Check
At `src/plugins/agents/index.ts:32`, the plugin registration is:
```typescript
register: (registry: unknown) => {
  const reg = registry as Registry;
  reg.register('agent-spawner', new AgentSpawnerPlugin(reg));
},
```

The `AgentSpawnerPlugin` constructor (at `src/plugins/agents/spawner.ts:90`) accepts two parameters:
```typescript
constructor(registry?: Registry, onProgressFactory?: OnProgressFactory) {
  this._registry = registry;
  this._onProgressFactory = onProgressFactory;
}
```

The `_onProgressFactory` is used at line 148 to wire `onProgress` into `AgentLoop`:
```typescript
onProgress: this._onProgressFactory?.(config.sessionId),
```

Since `onProgressFactory` is not passed during registration, `this._onProgressFactory` is `undefined`, and the optional chaining `?.` means `onProgress` is never set on spawned agent loops.

### ACP Spec Check
KB-10 (Implementation Guide, section 6) states that tool executions must be visible as ACP `tool_call` updates with status transitions (`pending` → `running` → `completed`). The `onProgressFactory` is the bridge between the L3 agent loop and the L2 ACP layer for generating `tool_call`/`tool_call_update` notifications. Without it, tool execution progress is invisible to ACP clients.

### Verdict: CONFIRMED
`AgentSpawnerPlugin` is constructed with only `reg` and no `onProgressFactory`. The second constructor parameter is omitted, so `_onProgressFactory` is `undefined`. All agents spawned through the standard plugin path will never emit ACP-visible progress events.

## Remediation
1. Pass `onProgressFactory` during plugin registration. This requires the ACP connection or a bridge to be available at registration time:
   ```typescript
   register: (registry: unknown, options?: { onProgressFactory?: OnProgressFactory }) => {
     const reg = registry as Registry;
     reg.register('agent-spawner', new AgentSpawnerPlugin(reg, options?.onProgressFactory));
   },
   ```
2. Alternatively, make the factory settable after construction:
   ```typescript
   const spawner = new AgentSpawnerPlugin(reg);
   reg.register('agent-spawner', spawner);
   // Later, when ACP connection is established:
   spawner.setOnProgressFactory(factory);
   ```
3. Wire the factory to emit `tool_call` and `tool_call_update` ACP session notifications.
