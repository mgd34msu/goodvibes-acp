# ISS-039 — Trigger fire count incremented before handler validation

**Severity**: Major
**File**: `src/core/trigger-engine.ts`
**KB Topic**: KB-08: Error Isolation

## Original Issue
Fire count is incremented before handler lookup. If the handler is not found or `canHandle` returns false, the fire count is still inflated. For triggers with `maxFires`, this causes premature exhaustion — the trigger stops firing before it has actually executed `maxFires` times.

## Verification

### Source Code Check
Lines 205-220 of `trigger-engine.ts`:
```typescript
// Increment fire count
state.fireCount++;

// Look up handler
const handler = this._registry.getOptional<ITriggerHandler>(definition.handlerKey);
if (!handler) {
  // No handler registered — skip silently
  continue;
}

// Check handler capability
if (!handler.canHandle(definition)) {
  continue;
}
```
The fire count is incremented at line 206, before the handler lookup (line 209) and the `canHandle` check (line 215). Both `continue` branches skip execution but do not decrement the fire count. For triggers with a `maxFires` limit, each failed lookup or capability check consumes one fire, causing premature exhaustion.

### ACP Spec Check
KB-08 (Extensibility) covers error isolation patterns. While the trigger engine is not directly part of the ACP protocol, incorrect fire counting affects the reliability of event-driven behavior that may be tied to ACP session lifecycle events.

### Verdict: CONFIRMED
The fire count increment occurs before handler validation. Triggers with `maxFires` will be exhausted prematurely if their handlers are not yet registered or cannot handle the event.

## Remediation
1. Move `state.fireCount++` to after the `canHandle` check, just before `handler.execute()`.
2. This ensures the fire count only reflects actual handler executions.
3. Verify that `maxFires` comparison (presumably earlier in `evaluate()`) uses the pre-increment value correctly after the move.
