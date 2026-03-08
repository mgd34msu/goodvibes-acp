# ISS-039 — ServiceAuthOrchestrator Is Dead Code — Not Wired to ACP

**Severity**: Major
**File**: src/extensions/services/auth.ts:54
**KB Topic**: Extension Methods (08-extensibility.md; 10-implementation-guide.md section 10)

## Original Issue
`ServiceAuthOrchestrator` has a TODO comment and is never imported or instantiated outside its own module and the barrel export.

## Verification

### Source Code Check
At `src/extensions/services/auth.ts:54-63`, the class is defined with a TODO:
```typescript
/**
 * Handles outbound authentication to external services (API keys, tokens).
 * NOT the same as ACP inbound client authentication (which uses authMethods/authenticate).
 * TODO: Wire into runtime via service index, or remove if not needed.
 * ...
 */
export class ServiceAuthOrchestrator {
```

A grep for `ServiceAuthOrchestrator` across all `src/**/*.ts` files (excluding the definition file) returns **zero results**. The class is exported but never imported or instantiated anywhere in the codebase.

### ACP Spec Check
KB-08 (Extensibility) states custom agent functionality should be exposed via `_`-prefixed extension methods (e.g., `_goodvibes/auth`). KB-10 (Implementation Guide, section 10) describes how extension methods should be wired. An exported but never-used class provides no ACP-accessible functionality and constitutes dead code.

### Verdict: CONFIRMED
`ServiceAuthOrchestrator` is dead code. It is:
1. Exported but never imported anywhere else in the codebase
2. Contains a TODO explicitly saying "Wire into runtime via service index, or remove if not needed"
3. Not exposed via any ACP extension method

## Remediation
1. **Option A (Wire it):** Create a `_goodvibes/auth` extension method handler and instantiate `ServiceAuthOrchestrator` in the runtime:
   ```typescript
   // In agent factory or extension method handler
   case '_goodvibes/auth':
     return authOrchestrator.handleRequest(params);
   ```
2. **Option B (Remove it):** Delete the class entirely if outbound service auth is not needed. Dead code increases maintenance burden and gives a false impression of capability.
3. Remove the TODO comment once resolved.
