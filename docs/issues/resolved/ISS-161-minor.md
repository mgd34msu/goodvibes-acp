# ISS-161 — No URL Validation on ServiceRegistry.register()

**Severity**: Minor
**File**: src/extensions/services/registry.ts:153
**KB Topic**: Initialization

## Original Issue
**[src/extensions/services/registry.ts:153]** No validation that `config.endpoint` is a valid URL. *(Initialization)*

## Verification

### Source Code Check
Line 153 is the `register()` method signature:
```typescript
register(name: string, config: ServiceConfig): void {
  const entry: ServiceEntry = {
    name,
    config,
    registeredAt: new Date().toISOString(),
  };
  const idx = this._store.services.findIndex((s) => s.name === name);
  if (idx >= 0) {
    this._store.services[idx] = entry;
  } else {
    this._store.services.push(entry);
  }
  this._bus.emit('service:registered', { name, config });
}
```
`ServiceConfig.endpoint` is typed as `string` with no runtime validation. No URL parsing or format check is performed before accepting the config.

### ACP Spec Check
The ACP specification does not define a `ServiceRegistry` component or mandate URL validation on service registrations. The spec covers session MCP server configuration (which uses URLs/commands), but the GoodVibes `ServiceRegistry` is an internal service management abstraction, not an ACP protocol element.

### Verdict: NOT_ACP_ISSUE
The missing URL validation is a real defensive programming concern — registering an invalid URL would produce unhelpful errors at request time rather than at registration time. However, the `ServiceRegistry` is a GoodVibes-internal component not defined by or required by the ACP specification. The spec does not mandate URL validation on service registrations. This is a code quality issue, not an ACP compliance issue.

## Remediation
N/A — Not an ACP compliance issue.

For code quality improvement (optional):
- Add a `URL` constructor validation in `register()`: `new URL(config.endpoint)` throws on invalid URLs
- Return an error or throw with a descriptive message if the URL is malformed
