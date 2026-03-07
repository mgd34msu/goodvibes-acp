# ISS-062: Entire external/ module is dead code

**Severity**: Major
**File**: src/extensions/external/ (all files)
**Line(s)**: All (~690 lines across 4 files)
**Topic**: TypeScript SDK

## Issue Description
Entire `src/extensions/external/` module is dead code — zero imports outside its directory. Approximately 690 lines unintegrated.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/09-typescript-sdk.md
- **Spec Says**: ACP SDK defines session updates, extension methods, and notifications. External event sources would need to be surfaced through ACP extension notifications (`extNotification`) or session updates to be protocol-compliant.
- **Confirmed**: Yes
- **Notes**: The external module (HTTP listener, file watcher, normalizer) has no integration with ACP methods. The barrel `src/extensions/index.ts` re-exports it, but `src/extensions/index.ts` itself has zero imports from outside `src/extensions/`.

### Source Code Check
- **Code Exists**: Yes (4 files: index.ts, normalizer.ts, http-listener.ts, file-watcher.ts)
- **Code Shows**: Grep for `external/` across `src/**/*.ts` (excluding `src/extensions/external/**`) returns only `src/extensions/index.ts` (barrel re-export). No file outside the module imports from it. The barrel itself (`src/extensions/index.ts`) has zero consumers outside `src/extensions/`.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Either integrate the external event module into the ACP agent via `extNotification()` for events
2. Or remove the entire `src/extensions/external/` directory
3. If kept, connect `NormalizerRegistry` output to `eventBus` and wire `eventBus` events to ACP session notifications
