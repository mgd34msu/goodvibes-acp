# ISS-064 — sessionInfoUpdate uses title field correctly per SDK, not content

**Severity**: Minor
**File**: `src/extensions/acp/agent.ts`
**KB Topic**: KB-04: SessionInfoUpdate

## Original Issue
The function uses `sessionUpdate: 'session_info_update'` and constructs a `SessionInfoUpdate` with a `title` field. The ACP spec defines `SessionInfoUpdate` with a `content: ContentBlock` field, not `title`, and the discriminator should be `"session_info"`.

## Verification

### Source Code Check
In `src/extensions/acp/agent.ts` lines 96-101, `sessionInfoUpdate()` constructs:
```typescript
const update: schema.SessionInfoUpdate & { sessionUpdate: 'session_info_update' } = {
  sessionUpdate: 'session_info_update',
  title,
};
```

### ACP Spec Check
KB-04 spec prose (lines 289-315) defines `SessionInfoUpdate` with `sessionUpdate: "session_info"` and `content: ContentBlock`. However, the installed SDK (`types.gen.d.ts` lines 2317-2336) defines `SessionInfoUpdate` with `title?: string | null` and `updatedAt?: string | null` — no `content` field. The SDK `SessionUpdate` union uses `sessionUpdate: "session_info_update"` as the discriminator (line 2533).

Per task context: SDK is authoritative over KB prose.

### Verdict: PARTIAL
The code correctly uses the SDK's `title` field and `session_info_update` discriminator, which contradicts the issue's claim that it should use `content: ContentBlock` and `session_info`. However, there is a mismatch between KB-04 spec prose and the SDK. The code is correct per SDK, making the issue's remediation wrong. The only valid concern is that the KB prose and SDK are out of sync, which is a documentation issue, not a code issue.

## Remediation
The code is correct per the installed SDK types. No code change needed. The KB-04 documentation should be updated to match the SDK's `SessionInfoUpdate` shape (`title`, `updatedAt`) and discriminator (`session_info_update`).
