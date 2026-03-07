# ISS-173 — `PermissionStatus` Uses String Enum Instead of Wire Boolean

**Severity**: Minor
**File**: src/types/permissions.ts:29-30
**KB Topic**: Permissions

## Original Issue
`PermissionStatus` defines `'granted' | 'denied'` but spec uses simple boolean `granted: true|false`. Document mapping explicitly: `status: 'granted'` equals `granted: true` on wire.

## Verification

### Source Code Check
`src/types/permissions.ts` line 29:
```typescript
export type PermissionStatus = 'granted' | 'denied';
```

This is used in `PermissionResult` (lines 56-59):
```typescript
export type PermissionResult = {
  status: PermissionStatus;
  reason?: string;
};
```

`PermissionResult` is an internal type — it is the internal representation returned by `PermissionGate.check()`, not the wire format sent to or received from the client. The ACP wire response is `{ granted: boolean }` from the client back to the agent via `session/request_permission`.

### ACP Spec Check
KB `05-permissions.md` shows the ACP wire format:
```json
{ "result": { "granted": true } }  // granted
{ "result": { "granted": false } } // denied
```

The SDK method `AgentSideConnection.requestPermission()` returns `Promise<{ granted: boolean }>`. This is the boundary where the conversion must happen — when the agent receives the `{ granted: boolean }` from the SDK, it maps it to the internal `PermissionStatus`.

The issue identifies a real impedance mismatch: the internal type uses a string enum (`'granted' | 'denied'`) rather than matching the SDK's boolean pattern. While not a wire format bug (the SDK handles the wire), code that converts `{ granted: boolean }` → `PermissionStatus` must do an explicit mapping, and callers reading `PermissionResult.status === 'granted'` must know this mapping.

### Verdict: PARTIAL
The internal `PermissionStatus` string enum does not match the ACP SDK's `{ granted: boolean }` pattern. This creates a necessary but undocumented translation layer. The wire format itself is not broken (the SDK handles it), but the mapping is implicit and error-prone. The issue is slightly overstated — it says "spec uses boolean" but the internal type can legitimately differ from the wire; however, the lack of explicit documented mapping is a real maintenance risk.

## Remediation
1. Add a JSDoc comment to `PermissionStatus` explicitly documenting the mapping:
   ```typescript
   /**
    * Internal permission check result.
    * Maps to ACP wire format: 'granted' → { granted: true }, 'denied' → { granted: false }.
    */
   export type PermissionStatus = 'granted' | 'denied';
   ```
2. Ensure the conversion point (where `{ granted: boolean }` from SDK is mapped to `PermissionStatus`) has an explicit utility function:
   ```typescript
   export function fromGrantedBoolean(granted: boolean): PermissionStatus {
     return granted ? 'granted' : 'denied';
   }
   ```
3. Alternatively, align the internal type: replace `PermissionStatus` with `{ granted: boolean }` and add `reason?: string` directly, eliminating the translation.
