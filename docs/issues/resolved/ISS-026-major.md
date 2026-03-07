# ISS-026: Missing JSON-RPC 2.0 error codes in constants

**Severity**: Major
**File**: src/types/constants.ts
**Line(s)**: entire file (after line 36)
**Topic**: Overview

## Issue Description
Missing JSON-RPC 2.0 error codes. Add `JSON_RPC_ERROR_CODES` with `PARSE_ERROR=-32700`, `INVALID_REQUEST=-32600`, `METHOD_NOT_FOUND=-32601`, `INVALID_PARAMS=-32602`, `INTERNAL_ERROR=-32603`.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 01-overview.md lines 94-105 (error response example with code -32600), KB 02-initialization.md lines 486-496 (standard JSON-RPC error codes table)
- **Spec Says**: ACP uses JSON-RPC 2.0, which defines standard error codes: -32700 (Parse error), -32600 (Invalid Request), -32601 (Method not found), -32602 (Invalid params), -32603 (Internal error), and -32000 to -32099 (implementation-defined). The KB explicitly shows these codes in the protocol version mismatch error handling.
- **Confirmed**: Yes
- **Notes**: These are standard JSON-RPC 2.0 error codes, required for any conformant implementation.

### Source Code Check
- **Code Exists**: Yes (constants.ts exists but lacks error codes)
- **Code Shows**: The file defines `Layer`, `RUNTIME_VERSION`, `STATE_SCHEMA_VERSION`, various defaults, `REGISTRY_KEYS`, and `WRFC_TOOL_NAMES`. No JSON-RPC error codes are defined anywhere in the file. No `JSON_RPC_ERROR_CODES` or individual error code constants exist.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add to `src/types/constants.ts`:
```typescript
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;
```
2. Use these constants wherever JSON-RPC errors are constructed (e.g., protocol version mismatch in initialize)
