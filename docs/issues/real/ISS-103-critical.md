# ISS-103 — `isGranted()` parses outcome-based response instead of spec-defined `{ granted: boolean }`

**Severity**: Critical  
**File**: `src/extensions/acp/permission-gate.ts`  
**Lines**: 103-109  
**KB Reference**: KB-05 (Response Format)  
**Iteration**: 3

## Description

The ACP spec response for `session/request_permission` is `{ granted: boolean }`. The `isGranted()` function instead parses `outcome.outcome === 'cancelled'` and checks `outcome.optionId` — an entirely different response model based on the SDK's `RequestPermissionOutcome` type.

The code comments (ISS-014) acknowledge this SDK divergence and explain the rationale.

## Source Evidence

```typescript
// src/extensions/acp/permission-gate.ts:103
function isGranted(outcome: acp.RequestPermissionOutcome): boolean {
  if (outcome.outcome === 'cancelled') {
    return false;
  }
  // ... checks optionId against allow_once/allow_always kinds
}
```

## Spec Evidence

KB-05 response format:
```json
{
  "result": {
    "granted": true
  }
}
```

### Verdict: CONFIRMED

The response parsing uses `outcome.outcome` and `outcome.optionId` instead of `response.granted`. If the SDK aligns with the wire spec, `response.outcome` will not exist and this function will break.

## Remediation

1. Add a version-aware response parser that checks for `response.granted` (spec path) first
2. Fall back to `response.outcome` (current SDK path) only when the boolean field is absent
3. Example:
```typescript
function isGranted(response: unknown): boolean {
  if ('granted' in response) return response.granted;
  // SDK fallback
  const outcome = response as acp.RequestPermissionOutcome;
  if (outcome.outcome === 'cancelled') return false;
  // ... existing optionId logic
}
```
