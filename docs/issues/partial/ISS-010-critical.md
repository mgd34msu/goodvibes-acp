# ISS-010 — `isGranted()` receives full response object but casts incorrectly
**Severity**: Critical
**File**: `src/extensions/acp/permission-gate.ts`
**KB Topic**: KB-10: Permissions

## Original Issue
`isGranted(response)` receives the full `RequestPermissionResponse` and casts it as `RequestPermissionOutcome`. The SDK response shape is `{ outcome: RequestPermissionOutcome }`, so `response.outcome` is the inner object. The cast papers over a potential unwrapping bug.

## Verification

### Source Code Check
`src/extensions/acp/permission-gate.ts` `isGranted()` (lines 104-117):
```
function isGranted(response: unknown): boolean {
  // Spec path: { granted: boolean } — check this first for forward compatibility
  if (response !== null && typeof response === 'object' && 'granted' in response) {
    return Boolean((response as { granted: unknown }).granted);
  }
  // SDK fallback path: { outcome: { outcome, optionId } }
  const outcome = (response as acp.RequestPermissionOutcome | undefined);
  if (!outcome) return false;
  if (outcome.outcome === 'cancelled') {
    return false;
  }
  return outcome.optionId === OPTION_ALLOW_ONCE || outcome.optionId.startsWith('allow');
}
```

The function receives the full `RequestPermissionResponse` (`{ outcome: RequestPermissionOutcome }`) but casts it directly as `RequestPermissionOutcome` on line 111. This means `outcome.outcome` is actually `response.outcome` (the inner object), and `outcome.optionId` would be `response.optionId` (which doesn't exist).

### ACP Spec Check
SDK `RequestPermissionResponse` (types.gen.d.ts:1914-1929):
```
export type RequestPermissionResponse = {
    _meta?: { [key: string]: unknown } | null;
    outcome: RequestPermissionOutcome;
};
```

SDK `RequestPermissionOutcome` (types.gen.d.ts:1875-1879):
```
export type RequestPermissionOutcome = {
    outcome: "cancelled";
} | (SelectedPermissionOutcome & {
    outcome: "selected";
});
```

So `response.outcome` is the `RequestPermissionOutcome`, and `response.outcome.outcome` is the discriminator (`'cancelled'` or `'selected'`).

### Verdict: PARTIAL
The cast is technically incorrect — `response` is `RequestPermissionResponse` (with `.outcome` property), not `RequestPermissionOutcome` directly. However, in practice the code partially works because:
- `(response as RequestPermissionOutcome).outcome` evaluates to `response.outcome` which is the `RequestPermissionOutcome` object, and this object itself has an `.outcome` discriminator field, so the cancelled check would fail (comparing an object to the string `'cancelled'`).
- The `optionId` check (`outcome.optionId`) accesses `response.optionId` which is undefined, causing the function to return false.

The function actually works because the "spec path" check (`'granted' in response`) catches the case first when a future spec response is returned. For the current SDK, the cast results in `isGranted` always returning `false` for granted permissions (since `optionId` is undefined on the response object). This is a latent bug that would manifest when permission prompting is actually exercised.

## Remediation
1. Unwrap `response.outcome` before processing:
   ```typescript
   const resp = response as acp.RequestPermissionResponse;
   const outcome = resp.outcome;
   if (!outcome) return false;
   if (outcome.outcome === 'cancelled') return false;
   if (outcome.outcome === 'selected') {
     return outcome.optionId === OPTION_ALLOW_ONCE || outcome.optionId.startsWith('allow');
   }
   return false;
   ```
2. Remove the `unknown` parameter type and accept `RequestPermissionResponse` directly for type safety.
