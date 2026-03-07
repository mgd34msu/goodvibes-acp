# ISS-014: Options-based permission model may not exist in ACP wire spec

**Severity**: Critical
**File**: src/extensions/acp/permission-gate.ts
**Line(s)**: 63-86
**Topic**: Permissions

## Issue Description
Entire options-based permission model (`buildPermissionOptions`, `isGranted` with outcome/optionId parsing) does not exist in ACP spec. Spec defines simple `granted: true|false`. The issue recommends removing `buildPermissionOptions()` and `isGranted()` and using boolean check on `response.granted`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 43-65 (wire response) and docs/acp-knowledgebase/09-typescript-sdk.md, lines 147-165 (SDK response)
- **Spec Says**: The wire protocol response is `{ granted: boolean }`. The SDK's `RequestPermissionResponse` uses `{ outcome: { outcome: 'selected', optionId: string } }`. These are fundamentally different response shapes.
- **Confirmed**: Partial
- **Notes**: The `buildPermissionOptions()` and `isGranted()` functions exist because the SDK's `requestPermission` returns an `outcome`-based response, not a simple `granted` boolean. The code is a reasonable adapter between the SDK's complex response and a simple granted/denied result. If the SDK were to change to match the wire format, these functions would become unnecessary.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `buildPermissionOptions()` (lines 63-68) constructs `[{ optionId: 'allow_once', kind: 'allow_once', name: 'Allow' }, { optionId: 'reject_once', kind: 'reject_once', name: 'Deny' }]`. `isGranted()` (lines 80-86) checks `outcome.outcome === 'cancelled'` returning false, otherwise checks if `outcome.optionId` starts with 'allow'. These are adapter functions for the SDK's response format.
- **Issue Confirmed**: Partial

## Verdict
PARTIAL
The options-based model is an SDK requirement, not a spec requirement. The functions are necessary given the current SDK API. The wire spec uses simple `granted: boolean` but the SDK enforces the options/outcome pattern. The implementation is correct for the SDK but diverges from the wire spec. The severity should be reduced from Critical to Major since the code works correctly with the SDK.

## Remediation Steps
1. Add documentation comments explaining these functions exist to bridge SDK/wire-spec divergence
2. If the SDK aligns with wire format in future, simplify to `response.granted` boolean check
3. Consider wrapping the entire SDK interaction in an adapter that could switch implementations
