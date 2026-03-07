# ISS-006: `session_info` update uses wrong discriminator and payload shape

**Severity**: Critical
**File**: src/extensions/acp/agent.ts
**Line(s)**: 63-64
**Topic**: Prompt Turn

## Issue Description
`session_info` update emits wrong discriminator `'session_info_update'` and wrong payload shape. Correct: `{ sessionUpdate: 'session_info', content: { type: 'text', text: title } }`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/04-prompt-turn.md lines 289-315
- **Spec Says**: The `session_info` update uses discriminator `sessionUpdate: "session_info"` with payload `{ content: ContentBlock }`. The TypeScript interface is `SessionInfoUpdate { sessionUpdate: "session_info"; content: ContentBlock; }`.
- **Confirmed**: Yes
- **Notes**: The code uses `'session_info_update'` as the discriminator value (with `_update` suffix) instead of `'session_info'`. Additionally, the payload uses `{ title, updatedAt }` instead of `{ content: { type: 'text', text: ... } }`. Both the discriminator and payload shape are wrong.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 64: `return { sessionUpdate: 'session_info_update' as const, title, updatedAt };`. This sends `session_info_update` (wrong discriminator) with `title` and `updatedAt` fields (wrong payload -- should be `content: ContentBlock`).
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
Both the discriminator value and payload shape are wrong. The discriminator should be `session_info` (no `_update` suffix), and the payload should use `content: { type: 'text', text: title }` instead of raw `title` and `updatedAt` fields. Clients will not recognize this update type.

## Remediation Steps
1. Change the discriminator from `'session_info_update'` to `'session_info'`
2. Change the payload from `{ title, updatedAt }` to `{ content: { type: 'text', text: title } }`
3. Remove the `as const` cast -- the correct discriminator value should be a valid `SessionUpdate` variant
