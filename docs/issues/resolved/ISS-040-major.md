# ISS-040 — ServiceHealthChecker Is Dead Code — Not Exposed via ACP Extension Method

**Severity**: Major
**File**: src/extensions/services/health.ts:57
**KB Topic**: Extension Methods (08-extensibility.md; 10-implementation-guide.md section 10)

## Original Issue
`ServiceHealthChecker` has a TODO acknowledging it needs to be wired to a `_goodvibes/health` extension method. It is exported but never used.

## Verification

### Source Code Check
At `src/extensions/services/health.ts:57-67`, the class is defined with a TODO:
```typescript
/**
 * Checks external HTTP service health via HEAD/GET probes.
 * TODO: Wire into ACP extension method (e.g., _goodvibes/health) or remove.
 * ...
 */
export class ServiceHealthChecker {
```

A grep for `ServiceHealthChecker` across all `src/**/*.ts` files (excluding the definition file) returns **zero results**. The class is exported but never imported or instantiated anywhere in the codebase.

### ACP Spec Check
KB-08 (Extensibility) describes how custom functionality should be exposed via `_`-prefixed extension methods handled in `extMethod()`. KB-10 (Implementation Guide, section 10) provides the pattern for wiring extension methods. The health checker exists as a fully implemented class but is dead code from an ACP integration perspective since it is never wired to any extension method endpoint.

### Verdict: CONFIRMED
`ServiceHealthChecker` is dead code. It is:
1. Exported but never imported anywhere else in the codebase
2. Contains a TODO explicitly saying "Wire into ACP extension method (e.g., _goodvibes/health) or remove"
3. Not exposed via any ACP extension method
4. Fully implemented with health check logic but unreachable

## Remediation
1. **Option A (Wire it):** Create a `_goodvibes/health` extension method handler:
   ```typescript
   // In extMethod() handler
   case '_goodvibes/health':
     const checker = new ServiceHealthChecker(registry, eventBus);
     const results = await checker.checkAll();
     return { status: 'ok', services: results };
   ```
2. **Option B (Remove it):** Delete the class if service health checking is not a required feature. Dead code increases maintenance burden.
3. Remove the TODO comment once resolved.
