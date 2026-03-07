# ISS-013: Permission request uses SDK options-based format instead of spec wire format

**Severity**: Critical
**File**: src/extensions/acp/permission-gate.ts
**Line(s)**: 137-147
**Topic**: Permissions

## Issue Description
Permission request uses SDK options-based format (`options[]`, `toolCall{}`) instead of spec wire format. Correct wire format: `conn.requestPermission({ sessionId, permission: { type, title, description } })` with `response.granted` as boolean.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/05-permissions.md, lines 23-65 (wire format) and docs/acp-knowledgebase/09-typescript-sdk.md, lines 137-165 (SDK format)
- **Spec Says**: The ACP wire protocol defines `session/request_permission` with `params: { sessionId, permission: { type, title, description } }` and response `{ granted: boolean }`. However, the TypeScript SDK (`AgentSideConnection.requestPermission`) uses a different shape: `{ sessionId, options: PermissionOption[], toolCall: {...} }` with response `{ outcome: { outcome: 'selected', optionId: string } }`.
- **Confirmed**: Partial
- **Notes**: There is a real tension between the ACP wire protocol specification and the SDK's TypeScript API. The wire format uses simple `permission` + `granted: boolean`, while the SDK uses `options[]` + `toolCall{}` + `outcome`. The implementation follows the SDK API (which is what it actually calls), so the code compiles and works with the SDK. However, the wire format it produces does not match the spec documentation. This appears to be a spec/SDK divergence rather than a pure implementation error.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 137-147 call `this.conn.requestPermission({ sessionId, options: buildPermissionOptions(), toolCall: { toolCallId, title, status: 'pending', rawInput, ... } })`. This matches the SDK's `RequestPermissionRequest` type but not the spec wire format.
- **Issue Confirmed**: Partial

## Verdict
PARTIAL
The implementation correctly follows the SDK's TypeScript API for `requestPermission()`, which will compile and function. However, the SDK API diverges from the documented ACP wire protocol. The issue is real but the root cause is SDK/spec divergence, not a pure implementation bug. The implementation should be updated if/when the SDK aligns with the wire spec.

## Remediation Steps
1. Monitor the ACP SDK for updates that align `requestPermission` with the wire format
2. If the SDK adds a `permission`-based overload, switch to it
3. Consider adding a comment documenting the SDK/spec divergence at the call site
4. Verify with the SDK source whether the SDK internally translates the options-based format to the wire format
