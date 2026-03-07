# ISS-075: Fragile sessionId extraction in EventBus via unsafe cast

**Severity**: Minor
**File**: src/core/event-bus.ts
**Line(s)**: 167-169
**Topic**: Overview

## Issue Description
`sessionId` extraction is fragile — unsafe cast `(payload as Record<string, unknown>)?.sessionId`. EventBus should accept `sessionId` as explicit `emit()` parameter. Breaks on primitives, arrays, or payloads without sessionId.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/01-overview.md (Session Update Notifications)
- **Spec Says**: All ACP `session/update` notifications include `sessionId` as a top-level field in `params`. The protocol requires session-scoped updates. An event bus used internally should reliably associate events with sessions.
- **Confirmed**: Yes
- **Notes**: While the spec doesn't dictate internal event bus design, the pattern of extracting `sessionId` from arbitrary payloads is fragile and could cause session-scoped event routing to silently fail.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 167-169: `sessionId: (payload as Record<string, unknown>)?.sessionId as | string | undefined`. This unsafe cast will fail silently on: (1) primitive payloads (string, number, boolean), (2) array payloads, (3) payloads where sessionId is nested, (4) null payloads. The `sessionId` would be `undefined` and session-scoped event filtering would not work.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add an optional `sessionId` parameter to `emit()`: `emit<T>(type: string, payload: T, sessionId?: string): void`
2. Use the explicit parameter when available, falling back to payload extraction only as a convenience
3. Update all callers that have session context to pass `sessionId` explicitly
4. Add a type guard for the payload extraction fallback to handle non-object payloads safely
