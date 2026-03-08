# ISS-115 — Plugin `shutdown` callback does not flush analytics

**Severity**: Minor
**File**: `src/plugins/analytics/index.ts`
**KB Topic**: KB-08: Plugin Lifecycle

## Original Issue
The `shutdown` callback is a no-op. Analytics data loss on shutdown depends on external wiring.

## Verification

### Source Code Check
At lines 47-51:
```typescript
shutdown: async () => {
  // The engine instance is held only in the registry; graceful flush
  // is called directly via AnalyticsEngine.shutdown() from main.ts
  // if the consumer wires it up.
},
```
The callback is empty. The comment explains the design: the `AnalyticsEngine` instance is registered in the L1 Registry (line 45: `reg.register('analytics', new AnalyticsEngine())`), but the shutdown callback doesn't retrieve it to call `engine.shutdown()`. The engine DOES have a `shutdown()` method (engine.ts lines 326-328) that flushes via `syncAll()`, but the plugin lifecycle doesn't invoke it.

However, this is a deliberate architectural choice — the comment states that `main.ts` is responsible for calling `engine.shutdown()` directly. The shutdown responsibility is at the composition root, not the plugin.

### ACP Spec Check
KB-08 discusses extension methods and `_meta` fields. The ACP protocol does not define plugin lifecycle requirements — plugin shutdown is an implementation concern. There is no ACP requirement that analytics be flushed during shutdown.

### Verdict: PARTIAL
The shutdown callback IS a no-op, but the comment documents this as intentional — shutdown is delegated to `main.ts`. The analytics engine CAN be flushed; the question is whether the plugin should be self-contained. This is a software design concern, not an ACP compliance issue.

## Remediation
1. Retrieve the engine instance from the registry in the `shutdown` callback: `const engine = (registry as Registry).getOptional<AnalyticsEngine>('analytics');`
2. Call `await engine?.shutdown()` to flush pending writes.
3. This makes the plugin self-contained and removes the dependency on main.ts wiring.
