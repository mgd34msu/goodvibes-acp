# ISS-133: ExternalEventBridge emits inconsistent payload format

**Source**: `src/extensions/external/index.ts` lines 64-82
**KB Reference**: KB-08 (Extension Method Params)
**Severity**: Major

### Verdict: CONFIRMED

The `ExternalEventBridge.attach()` method forwards events from two sources to the shared `external:event` channel with inconsistent payload shapes:

- **Webhook handler** (line 65): Emits `event.payload` -- the inner payload extracted from a `NormalizedEvent`, which is an arbitrary object
- **File-watcher handler** (line 81): Constructs a full `NormalizedEvent` object with `source`, `type`, `payload`, `timestamp`, and `id` fields, then emits the entire object

Subscribers to `external:event` receive either a raw payload object or a `NormalizedEvent` depending on the source, with no way to distinguish which format they received. This breaks the consistency contract expected by downstream handlers.

### Remediation

1. Change the webhook handler to emit the full `NormalizedEvent` instead of just `event.payload`, matching the file-watcher handler's format
2. Alternatively, normalize both paths to emit the same shape, ensuring `external:event` always carries a `NormalizedEvent`
3. Add TypeScript generic typing to the `external:event` emission to enforce the payload type at compile time
