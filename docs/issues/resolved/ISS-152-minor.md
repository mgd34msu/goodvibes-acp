# ISS-152: `register()` emits full config including credentials in event payload

**Source**: `src/extensions/services/registry.ts` line 198
**KB Reference**: KB-08 (Security)
**Severity**: Minor

## Issue Description
The `service:registered` event at line 198 emits `{ name, config }` where `config` is the full `ServiceConfig` object, potentially including auth credentials (API keys, tokens). Any event listener could inadvertently log or transmit these.

### Verdict: CONFIRMED

Line 198 shows `this._bus.emit('service:registered', { name, config })` passing the raw config object. Event listeners subscribed to `service:registered` receive the full config including any credential fields. This is a real security concern -- event payloads should never contain secrets since event buses are designed for broad consumption.

## Remediation
1. Create a `redactConfig(config)` helper that strips credential fields (`apiKey`, `token`, `secret`, `password`, etc.)
2. Emit redacted config: `this._bus.emit('service:registered', { name, config: redactConfig(config) })`
3. Alternatively, emit only the service name and non-sensitive metadata (endpoint URL, service type)
