# ISS-102 — `requestPermission` uses SDK-specific options/toolCall shape instead of spec-defined permission object

**Severity**: Critical  
**File**: `src/extensions/acp/permission-gate.ts`  
**Lines**: 163-168  
**KB Reference**: KB-05 (Wire Format)  
**Iteration**: 3

## Description

The ACP wire spec (KB-05) defines `session/request_permission` with a `permission` field containing `{ type, title, description }` and a response of `{ granted: boolean }`. The implementation instead uses the SDK's `options`-based model with `PermissionOption[]` and `toolCall` fields.

The code comments explicitly acknowledge this divergence (ISS-013, ISS-014) and explain it follows the SDK API since that is the TypeScript interface compiled against.

## Source Evidence

```typescript
// src/extensions/acp/permission-gate.ts:163-168
// SDK/Spec divergence (ISS-013): The ACP wire spec defines requestPermission as
// { sessionId, permission: { type, title, description } } → { granted: boolean }.
// The SDK (v0.15.0) instead uses { sessionId, options: PermissionOption[], toolCall }
// → { outcome: { outcome, optionId } }. We follow the SDK API since it's the actual
// TypeScript interface we compile against.
```

## Spec Evidence

KB-05 wire format:
```json
{
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123def456",
    "permission": {
      "type": "shell",
      "title": "Run shell command",
      "description": "rm -rf ./dist && npm run build"
    }
  }
}
```

### Verdict: CONFIRMED

The implementation uses an entirely different request structure from the spec. While the code documents the divergence and follows the SDK (which is authoritative for compilation), there is no abstraction layer to switch to the spec format.

## Remediation

1. Create an abstraction/adapter function that constructs the spec-compliant `permission` object shape
2. Add a version-detection mechanism or feature flag to select between SDK format and spec format
3. Structure the code so the spec-compliant path is ready to activate when the SDK aligns with the wire spec
4. Example: `buildPermissionRequest(title, description, type)` returns either `{ permission: {...} }` or `{ options: [...], toolCall: {...} }` based on the detected SDK version
