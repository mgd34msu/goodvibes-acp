# ISS-002 — `requestPermission` call uses SDK-specific options/toolCall shape instead of spec-defined permission object

**Severity**: Critical
**File**: `src/extensions/acp/permission-gate.ts`
**KB Topic**: KB-05: Wire Format

## Original Issue
The ACP wire spec defines `session/request_permission` with a `permission` field containing `type`, `title`, and `description`. The implementation instead sends `options` and `toolCall` fields — an entirely different request structure. While documented as ISS-013/ISS-017 SDK divergence, there is no abstraction layer or feature flag to switch to the spec format.

## Verification

### Source Code Check
Lines 175-185 of `src/extensions/acp/permission-gate.ts`:
```typescript
const response = await this.conn.requestPermission({
  sessionId: this.sessionId,
  options: buildPermissionOptions(),
  toolCall: {
    toolCallId,
    title: request.title,
    status: 'pending',
    rawInput: request._meta?.rawInput ?? null,
    ...(request._meta ? { _meta: request._meta } : {}),
  },
});
```

The code uses `options` + `toolCall` instead of `permission: { type, title, description }`.

### ACP Spec Check
KB-05 lines 27-41 define the wire format:
```json
{
  "method": "session/request_permission",
  "params": {
    "sessionId": "...",
    "permission": {
      "type": "shell",
      "title": "Run shell command",
      "description": "rm -rf ./dist && npm run build"
    }
  }
}
```

KB-09 lines 147-165 confirm the SDK uses a different shape with `options: PermissionOption[]` and `toolCall` — this is a documented SDK/spec divergence.

### Verdict: CONFIRMED
The code correctly uses the SDK API (which is what compiles and runs), but the wire format diverges from the spec. The comments acknowledge this (ISS-013, ISS-017). The issue is valid: there is no abstraction layer to switch to spec-compliant format when the SDK aligns.

## Remediation
1. Add an abstraction layer (e.g., `buildPermissionRequest()`) that constructs either the SDK format or the spec-compliant `permission` object.
2. Include a version check or feature flag that selects the appropriate format.
3. Prepare the spec-compliant path so it can be activated when the SDK aligns:
   ```typescript
   permission: { type: request.type, title: request.title, description: request.description }
   ```
