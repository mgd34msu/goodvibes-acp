# ISS-022: WriteTextFileRequest field name mismatch in fs-bridge

**Severity**: Critical
**File**: src/extensions/acp/fs-bridge.ts
**Line(s)**: 76-80
**Topic**: TypeScript SDK

## Issue Description
`WriteTextFileRequest` sends `{ path, content, sessionId }` but SDK field is `text`, not `content`. Change `content,` to `text: content,`.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 09-typescript-sdk.md lines 195-200
- **Spec Says**: `writeTextFile` request shape is `{ sessionId: string, path: string, text: string }`. The field name is `text`, not `content`.
- **Confirmed**: Yes
- **Notes**: None

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 76-80 call `this.conn.writeTextFile({ path, content, sessionId })`. The `content` parameter is passed as a property name directly, but the SDK expects a `text` field. The `content` field would be silently ignored, meaning writes through the ACP bridge would send empty/undefined content.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Change line 78 from `content,` to `text: content,`
