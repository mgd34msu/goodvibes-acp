# ISS-003: Missing `authMethods` field in initialize response

**Severity**: Critical
**File**: src/extensions/acp/agent.ts
**Line(s)**: 112-127
**Topic**: Initialization

## Issue Description
Missing `authMethods` field in initialize response. Per spec, `authMethods` is REQUIRED -- even the minimal example includes `"authMethods": []`. Add `authMethods: []`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/02-initialization.md lines 136-148, 150-173
- **Spec Says**: `InitializeResult` requires `authMethods: AuthMethod[]`. The minimal response example explicitly includes `"authMethods": []`. The implementation checklist states: "`authMethods` must be `[]` if no auth required (not omitted)".
- **Confirmed**: Yes
- **Notes**: This is a REQUIRED field per the spec. Omitting it means compliant clients cannot determine whether authentication is needed, potentially breaking the initialization flow.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: The `initialize()` method at lines 112-127 returns `{ protocolVersion, agentInfo, agentCapabilities }` with no `authMethods` field.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
The `authMethods` field is a required part of `InitializeResult` per the ACP spec and is missing from the initialize response. Clients rely on this field to determine the authentication flow.

## Remediation Steps
1. Add `authMethods: []` to the return object in the `initialize()` method (after `agentCapabilities`)
