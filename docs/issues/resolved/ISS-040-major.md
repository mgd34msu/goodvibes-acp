# ISS-040 — Error event emission creates potential infinite recursion loop

**Severity**: Major
**File**: `src/core/trigger-engine.ts`
**KB Topic**: KB-08: Error Events

## Original Issue
The engine subscribes to `'*'` (all events) and emits `'error'` events on handler failure. If any trigger has `eventPattern: '*'` or `eventPattern: 'error'`, the engine's own error emission re-enters `evaluate()`, creating potential infinite recursion.

## Verification

### Source Code Check
Line 105 — the trigger engine subscribes to all events:
```typescript
this._subscription = this._eventBus.on('*', (event: EventRecord) => {
  this.evaluate(event);
});
```

Line 230 — on handler failure, an error event is emitted:
```typescript
handler.execute(definition, context).catch((err: unknown) => {
  this._eventBus.emit('error', {
    _meta: {
      '_goodvibes/source': 'trigger-engine',
      '_goodvibes/triggerId': definition.id,
      '_goodvibes/error': err instanceof Error ? err.message : String(err),
      '_goodvibes/timestamp': Date.now(),
    },
  });
});
```

The event bus's `_emitError` method (line 309) has a recursion guard (`if (sourceType === 'error') return`), but this guard only applies to errors thrown by event bus handlers — not to direct `emit('error', ...)` calls. The trigger engine calls `emit('error')` directly, which triggers the `*` subscriber, re-entering `evaluate()`. If a trigger matches `'error'` or `'*'` events and its handler throws, this creates an infinite loop.

### ACP Spec Check
KB-08 (Extensibility) discusses error event patterns. The `_meta` field usage for error context is correct per the spec, but the recursion risk is an implementation bug.

### Verdict: CONFIRMED
The recursion path exists: `emit('error')` → `*` subscriber → `evaluate()` → handler throws → `emit('error')`. The event bus's `_emitError` guard does not prevent this because the trigger engine uses direct `emit()` calls rather than the error handler path. While the async `.catch()` means the recursion is not synchronous stack overflow (it's microtask-based), it would still produce an unbounded stream of error events consuming memory and CPU.

## Remediation
1. Add a re-entrancy guard in `evaluate()`: skip evaluation when `event.type === 'error'` and the payload contains `_goodvibes/source: 'trigger-engine'`.
2. Alternatively, use a boolean re-entrancy flag (`_emittingError`) that is set before emitting the error and cleared after.
3. Consider filtering out `'error'` events from trigger evaluation entirely, since error handling triggers can be registered through a separate mechanism.
