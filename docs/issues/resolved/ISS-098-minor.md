# ISS-098: No logging of client capabilities on initialize

**Severity**: Minor
**File**: src/extensions/acp/agent.ts
**Line(s)**: 109-110
**Topic**: Initialization

## Issue Description
No logging of client capabilities or `clientInfo` to stderr on initialize. Spec implementation checklist: "Agent logs client capabilities to stderr for debugging."

## Verification

### ACP Spec Check
- **Spec Reference**: KB 02-initialization.md, lines 499-511 (Implementation Checklist)
- **Spec Says**: Implementation checklist item: "Agent logs client capabilities to stderr (not stdout) for debugging." The reference implementation in the same KB shows: `console.error('Client: ${params.clientInfo?.name} v${params.clientInfo?.version}'); console.error('Client fs: ${clientHasFs}, terminal: ${clientHasTerminal}');`
- **Confirmed**: Yes
- **Notes**: This is listed as a best practice in the implementation checklist, not a protocol requirement. However, it is important for debugging ACP connection issues.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 109-110: `this._clientCapabilities = params.clientCapabilities ?? {};` — stores capabilities but does not log them. No `console.error` or any logging call in the `initialize()` method.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add stderr logging in the `initialize()` method:
   ```typescript
   const ci = params.clientInfo;
   console.error(`[ACP] Client: ${ci?.name ?? 'unknown'} v${ci?.version ?? '?'}`);
   console.error(`[ACP] Capabilities: fs=${!!params.clientCapabilities?.fs?.readTextFile}, terminal=${!!params.clientCapabilities?.terminal}`);
   ```
2. Use the project's logger if one exists, ensuring it writes to stderr (not stdout, which is reserved for JSON-RPC messages).
