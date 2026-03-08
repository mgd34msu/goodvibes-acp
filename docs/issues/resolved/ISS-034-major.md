# ISS-034 — Trigger Error Events Place Custom Fields at Root — Violates _meta Rule

**Severity**: Major
**File**: src/core/trigger-engine.ts:218-226
**KB Topic**: Extensibility — `_goodvibes/events` notification (08-extensibility.md line 71)

## Original Issue
Trigger handler failure events use custom fields (`source`, `triggerId`, `error`, `timestamp`) at the root of the event payload instead of placing implementation-specific data in `_meta`.

## Verification

### Source Code Check
At `src/core/trigger-engine.ts:218-226`, the error handler emits:
```typescript
handler.execute(definition, context).catch((err: unknown) => {
  this._eventBus.emit('error', {
    source: 'trigger-engine',
    triggerId: definition.id,
    error: err instanceof Error ? err : new Error(String(err)),
    timestamp: Date.now(),
  });
});
```
The fields `source`, `triggerId`, `error`, and `timestamp` are placed directly at the root of the event payload.

### ACP Spec Check
KB-08 (Extensibility, lines 345-348) states: "Implementations MUST NOT add custom fields at the root of protocol-defined types. All custom data goes in `_meta`." Within `_meta`, namespaced keys (e.g., `_goodvibes/source`) should be used to avoid collisions.

If these events are forwarded to ACP clients (e.g., via a `_goodvibes/events` notification), the root-level custom fields violate the protocol constraint.

### Verdict: CONFIRMED
Custom implementation fields (`source`, `triggerId`, `error`, `timestamp`) are placed at the root of the event payload. KB-08 explicitly prohibits this. These should be in `_meta` with namespaced keys.

## Remediation
1. Move custom fields into `_meta`:
   ```typescript
   this._eventBus.emit('error', {
     _meta: {
       '_goodvibes/source': 'trigger-engine',
       '_goodvibes/triggerId': definition.id,
       '_goodvibes/error': err instanceof Error ? err.message : String(err),
       '_goodvibes/timestamp': Date.now(),
     },
   });
   ```
2. Update any consumers of these error events to read from `_meta` instead of root fields.
3. Audit other `eventBus.emit()` calls for similar root-level custom field violations.
