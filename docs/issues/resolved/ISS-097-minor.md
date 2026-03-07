# ISS-097: Missing ACP_PROTOCOL_VERSION constant

**Severity**: Minor
**File**: src/types/constants.ts
**Line(s)**: after line 36
**Topic**: Overview

## Issue Description
Missing `ACP_PROTOCOL_VERSION` constant. Spec states "Protocol Version: 1". Add `export const ACP_PROTOCOL_VERSION = 1 as const`.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 01-overview.md, line 3; KB 02-initialization.md, lines 204-226
- **Spec Says**: "Protocol Version: 1 (MAJOR, integer only)". The protocol version is exchanged during initialization. "Current version: 1. Version 1 is the only stable version as of SDK v0.15.0."
- **Confirmed**: Yes
- **Notes**: The SDK exports `PROTOCOL_VERSION` which the agent code uses (`import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk'`). However, having a local constant in the L0 constants file provides a single source of truth for the codebase and enables static analysis.

### Source Code Check
- **Code Exists**: Yes (the file exists)
- **Code Shows**: `constants.ts` defines `RUNTIME_VERSION = '0.1.0'` (line 33) and `STATE_SCHEMA_VERSION = '1.0.0'` (line 36) but no ACP protocol version constant. The agent.ts file imports `PROTOCOL_VERSION` directly from the SDK.
- **Issue Confirmed**: Partial

## Verdict
PARTIAL

## Remediation Steps
1. Add after line 36:
   ```typescript
   /** ACP protocol version — spec states integer-only MAJOR versioning */
   export const ACP_PROTOCOL_VERSION = 1 as const;
   ```
2. Note: The SDK already exports `PROTOCOL_VERSION`. This is a "belt and suspenders" improvement for code clarity, not a functional bug. The agent.ts code already uses the SDK constant correctly.
