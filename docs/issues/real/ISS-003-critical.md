# ISS-003 — `isGranted()` parses outcome-based response instead of spec-defined `{ granted: boolean }`

**Severity**: Critical
**File**: `src/extensions/acp/permission-gate.ts`
**KB Topic**: KB-05: Response Format

## Original Issue
The ACP spec response is `{ granted: boolean }`. The implementation parses `outcome.outcome === 'cancelled'` and `outcome.optionId` — an entirely different response model. If the SDK aligns with the wire spec in a future version, this function will break because `response.outcome` will not exist.

## Verification

### Source Code Check
Lines 103-109 of `src/extensions/acp/permission-gate.ts`:
```typescript
function isGranted(outcome: acp.RequestPermissionOutcome): boolean {
  if (outcome.outcome === 'cancelled') {
    return false;
  }
  // outcome === 'selected' — check which option was picked
  return outcome.optionId === OPTION_ALLOW_ONCE || outcome.optionId.startsWith('allow');
}
```

The function parses an outcome-based model with `outcome.outcome` and `outcome.optionId`.

### ACP Spec Check
KB-05 lines 43-65 define the response as:
```json
{ "result": { "granted": true } }
```
or
```json
{ "result": { "granted": false } }
```

KB-09 lines 159-164 confirm the SDK returns `{ outcome: { outcome: "selected", optionId: string } }` instead.

### Verdict: CONFIRMED
The code correctly uses the current SDK response model, but the spec defines `{ granted: boolean }`. This is a documented SDK/spec divergence. The `isGranted()` function will break when the SDK aligns with the wire spec because `response.outcome` will not exist. The issue is about forward compatibility.

## Remediation
1. Add a version-aware response parser that checks for `response.granted` (spec path) first.
2. Fall back to `response.outcome` (current SDK path) only when the boolean field is absent:
   ```typescript
   function isGranted(response: unknown): boolean {
     if (typeof (response as any).granted === 'boolean') {
       return (response as any).granted;
     }
     // Legacy SDK path
     const outcome = (response as any).outcome;
     if (outcome?.outcome === 'cancelled') return false;
     return outcome?.optionId === OPTION_ALLOW_ONCE || outcome?.optionId?.startsWith('allow');
   }
   ```
