# ISS-027: Non-ACP transport types in TransportType union

**Severity**: Major
**File**: src/types/transport.ts
**Line(s)**: 31
**Topic**: Overview

## Issue Description
`TransportType` includes `'tcp'` and `'unix-socket'` which are not in the ACP spec. Align to `'stdio' | 'http' | 'websocket'` or document as GoodVibes-specific extensions.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 01-overview.md lines 37-63
- **Spec Says**: ACP defines two transport categories: (1) Local: ndjson over stdio, and (2) Remote: HTTP or WebSocket. The spec mentions `stdio`, `HTTP`, and `WebSocket` as the three transport options. No mention of `tcp` or `unix-socket` as ACP transports.
- **Confirmed**: Yes
- **Notes**: `tcp` and `unix-socket` could be legitimate GoodVibes-specific extensions for IPC, but they should be documented as non-ACP if kept.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 31 defines `export type TransportType = 'stdio' | 'tcp' | 'websocket' | 'unix-socket';`. This includes `tcp` and `unix-socket` which are not ACP-standard, and is missing `http` which IS ACP-standard.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Change to `export type TransportType = 'stdio' | 'http' | 'websocket';` for ACP-standard types
2. If `tcp` and `unix-socket` are needed for internal IPC, create a separate `InternalTransportType` or add them as `| 'tcp' | 'unix-socket'` with a JSDoc comment marking them as GoodVibes-specific extensions
3. Add `'http'` which is missing from the current type but is defined in the ACP spec
