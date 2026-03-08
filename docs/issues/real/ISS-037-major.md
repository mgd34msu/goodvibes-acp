# ISS-037: ExternalEventBridge drops NormalizedEvent fields on webhook forwarding

**Severity**: Major
**Category**: KB-08 Extensibility
**File**: `src/extensions/external/index.ts`
**Lines**: 65

## Description

The `ExternalEventBridge` listens for `external:webhook` events (which carry full `NormalizedEvent` objects) and re-emits only `event.payload`, dropping `source`, `type`, `id`, and `timestamp` fields that downstream consumers need for `_goodvibes/events` notifications.

### Verdict: CONFIRMED

Source line 65 shows:
```typescript
this._bus.emit('external:event', event.payload);
```
The `event` parameter is typed as `NormalizedEvent` (from the `on<NormalizedEvent>` generic), which contains `{ source, type, payload, timestamp, id }`. Only `payload` is forwarded. Compare with the file-watcher path (line 80) which correctly emits the full `normalized` object.

## Remediation

1. Change line 65 to emit the full event object:
   ```typescript
   this._bus.emit('external:event', event);
   ```
2. Note: The `event` from EventBus `on()` callback wraps the payload, so this may need to be `event` itself if it IS the NormalizedEvent, or the full normalized object needs reconstruction. Verify the EventBus callback signature.

## ACP Reference

KB-08: `_goodvibes/events` notifications require `source`, `type`, `id`, and `timestamp` for proper event correlation.
