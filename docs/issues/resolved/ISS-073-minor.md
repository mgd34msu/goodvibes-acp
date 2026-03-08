# ISS-073 — `HookContext` index signature enables root-level custom field leakage
**Severity**: Minor
**File**: `src/extensions/hooks/built-ins.ts`
**KB Topic**: KB-08: Protocol Types / Extensibility

## Original Issue
The `[key: string]: unknown` index signature allows arbitrary root-level keys that may leak into protocol types during serialization. KB-08 states custom fields belong in `_meta`.

## Verification

### Source Code Check
Lines 18-29 of `built-ins.ts`:
```typescript
export interface HookContext {
  event: string;
  timestamp: number;
  sessionId?: string;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;  // <-- index signature
}
```
The interface has both an explicit `_meta` field AND an open index signature. The `_meta` field was added per ISS-019, but the index signature remains, allowing arbitrary keys at the root level.

### ACP Spec Check
KB-08 states: "Every type in the ACP protocol includes an optional `_meta` field" for custom data. The extensibility model requires custom data to be placed in `_meta`, not at the root level. Unknown root-level keys violate the principle of forward-compatible protocol types.

### Verdict: CONFIRMED
The index signature allows arbitrary keys at the root level of HookContext, which could leak into serialized protocol messages. While `_meta` exists as the proper extensibility mechanism, the index signature undermines it by allowing the bypass.

## Remediation
1. Remove the `[key: string]: unknown` index signature from `HookContext`.
2. Add explicit optional fields for any known dynamic properties (e.g., `toolName`, `toolCallId`, `permissionType`).
3. Force all dynamic/custom data through the `_meta` field.
