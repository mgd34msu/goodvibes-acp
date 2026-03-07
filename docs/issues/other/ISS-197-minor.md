# ISS-197 — No Validation That config.endpoint Is a Valid URL

**Severity**: Minor
**File**: src/extensions/services/registry.ts:153
**KB Topic**: Initialization

## Original Issue

**[src/extensions/services/registry.ts:153]** No validation that `config.endpoint` is a valid URL. (Also noted as minor #161.) *(Initialization)*

## Verification

### Source Code Check

The `ServiceConfig` interface (lines 34-43 of `src/extensions/services/registry.ts`):
```typescript
export interface ServiceConfig {
  /** Base endpoint URL */
  endpoint: string;
  /** Authentication configuration */
  auth?: ServiceAuth;
  /** Additional headers to include on all requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}
```

The `register(name, config)` method (around line 153):
```typescript
register(name: string, config: ServiceConfig): void {
  const entry: ServiceEntry = {
    name,
    config,
    registeredAt: new Date().toISOString(),
  };
  // ... stores directly with no validation
  this._bus.emit('service:registered', { name, config });
}
```

No URL validation is performed. Any string — including empty string, relative paths, or malformed URLs — is accepted as `endpoint`. This is confirmed.

### ACP Spec Check

The ACP Initialization KB defines how agents declare MCP server capabilities (`mcp.http`, `mcp.sse`) and how clients provide MCP server URLs in `session/new`. The ACP spec requires that MCP server entries in `session/new` have valid URLs when `http` or `sse` transport is used.

However, `src/extensions/services/registry.ts` is the *internal* service registry for external API connections (the `precision_fetch` service registry feature), not the ACP MCP server capability negotiation. The `ServiceConfig.endpoint` stores URLs for named services used by the precision fetch tool — this is a GoodVibes extension, not an ACP protocol primitive.

The ACP Initialization spec does not govern how agents store and validate internal named service endpoints. This is an internal data validation concern.

### Verdict: NOT_ACP_ISSUE

The issue is real: accepting unvalidated endpoint strings will cause runtime errors at fetch time (potentially confusing `TypeError: Invalid URL` messages). Early validation in `register()` would provide better error messages. However, the ACP specification does not govern how agents validate their internal service registry entries. The `ServiceRegistry` is a GoodVibes-internal extension feature, and the ACP Initialization spec cited in the issue does not apply to this code path.

## Remediation

N/A (not an ACP compliance issue)

For robustness, validate the endpoint in `register()`:
```typescript
register(name: string, config: ServiceConfig): void {
  // Validate endpoint is a valid URL
  try {
    new URL(config.endpoint);
  } catch {
    throw new Error(`ServiceRegistry: invalid endpoint URL for service '${name}': ${config.endpoint}`);
  }
  // ... rest of registration
}
```
