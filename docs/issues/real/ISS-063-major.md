# ISS-063: NormalizedEvent format misaligned with ACP SessionNotification

**Severity**: Major
**File**: src/extensions/external/normalizer.ts
**Line(s)**: 19-30
**Topic**: TypeScript SDK

## Issue Description
`NormalizedEvent` format doesn't align with ACP `SessionNotification`. Uses `{source, type, payload}` instead of `{sessionId, update}`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/09-typescript-sdk.md, lines 116-135
- **Spec Says**: `SessionNotification` is `{ sessionId: string, update: { sessionUpdate: string, ... } }`. The `update` field is a discriminated union keyed by `sessionUpdate`.
- **Confirmed**: Yes
- **Notes**: `NormalizedEvent` has `{ source: string, type: string, payload: Record<string, unknown>, timestamp: number, id: string }` — completely different shape. No `sessionId`, no `sessionUpdate` discriminator.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 19-30 define `NormalizedEvent` with fields: `source`, `type`, `payload`, `timestamp`, `id`. None of these map to ACP `SessionNotification` fields. The format is designed for generic webhook normalization, not ACP protocol integration.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add an adapter that converts `NormalizedEvent` to ACP `SessionNotification` format
2. Map `source` + `type` to an appropriate `sessionUpdate` discriminator (e.g., `_goodvibes/external_event`)
3. Include `sessionId` context when emitting events through ACP
4. Note: This issue is moot if ISS-062 is resolved by removing the dead code
