# ISS-087: SessionEventType union missing state-changed and mode-changed events

**Severity**: Major
**File**: src/types/events.ts
**Line(s)**: 32-39
**Topic**: Sessions

## Issue Description
`SessionEventType` union missing `session:state-changed` and `session:mode-changed` -- both emitted by `SessionManager` but not typed.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md
- **Spec Says**: No direct mention of `session:state-changed` or `session:mode-changed` as ACP protocol events. The ACP spec defines session updates via `session/update` notifications (e.g., `config_options_update`), not internal event bus events. These are internal runtime events, not ACP wire protocol events.
- **Confirmed**: No
- **Notes**: The ACP spec does not define these internal event names. However, the issue is valid as a TypeScript type safety concern -- events are emitted but not typed.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 32-39 define `SessionEventType` with 7 values: `session:created`, `session:activated`, `session:prompt`, `session:updated`, `session:cancelled`, `session:completed`, `session:destroyed`. The issue claims `SessionManager` emits `session:state-changed` and `session:mode-changed` which are not in this union.
- **Issue Confirmed**: Partial -- the missing types are a type safety issue but not an ACP protocol compliance issue.

## Verdict
PARTIAL

## Remediation Steps
1. Verify that `SessionManager` actually emits `session:state-changed` and `session:mode-changed` events
2. If confirmed, add these to the `SessionEventType` union
3. Add proper event payload types for these events
