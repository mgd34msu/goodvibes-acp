# ISS-077 — `bridge.ts` referenced in review scope does not exist
**Severity**: Nitpick
**File**: N/A (expected `src/extensions/acp/bridge.ts`)
**KB Topic**: N/A: Scope

## Original Issue
Review scope references non-existent file. Actual files are `fs-bridge.ts`, `terminal-bridge.ts`, `agent-event-bridge.ts`.

## Verification

### Source Code Check
No file `src/extensions/acp/bridge.ts` exists. The actual bridge files are:
- `src/extensions/acp/fs-bridge.ts`
- `src/extensions/acp/terminal-bridge.ts`
- `src/extensions/acp/agent-event-bridge.ts`

### ACP Spec Check
N/A — this is a review scope reference issue, not a code or protocol issue.

### Verdict: NOT_ACP_ISSUE
This is a review scope configuration error, not an ACP protocol compliance issue. No source code is affected.

## Remediation
1. Update review scope to reference the actual bridge file names.
