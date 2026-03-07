# ISS-021: ReadTextFileResponse field name mismatch in fs-bridge

**Severity**: Critical
**File**: src/extensions/acp/fs-bridge.ts
**Line(s)**: 52
**Topic**: TypeScript SDK

## Issue Description
`ReadTextFileResponse` field accessed as `response.content` but SDK defines it as `{ text: string }`. Change to `response.text`.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 09-typescript-sdk.md lines 177-183
- **Spec Says**: `readTextFile` response shape is `{ text: string }`. The SDK example shows `// Response: { text: string }`.
- **Confirmed**: Yes
- **Notes**: The ACP spec URLs 404'd (site uses client-side rendering), but KB documentation is definitive and derived directly from SDK v0.15.0 types.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 52 reads `return response.content;` after calling `this.conn.readTextFile()`. The SDK `ReadTextFileResponse` type has a `text` field, not `content`. This would cause a runtime error (returning `undefined` instead of the file contents).
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Change line 52 from `return response.content;` to `return response.text;`
