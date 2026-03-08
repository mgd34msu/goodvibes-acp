# ISS-049 — Missing content field on work-complete tool_call_update

**Severity**: Major
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**KB Topic**: KB-06/KB-10: Tool Call Updates

## Original Issue
The work-complete handler emits a `tool_call_update` with `status: 'completed'` and `_meta` but no `content` field. Per the spec, completed tool calls should include `content` blocks with the tool's output text. No `locations` field is emitted either. Same omission applies to fix-complete (line 213) and review-complete (line 198).

## Verification

### Source Code Check
Work-complete handler (lines 182-187):
```typescript
this._emitter
  .emitToolCallUpdate(p.sessionId, toolCallId, 'completed', {
    '_goodvibes/phase': 'work',
    '_goodvibes/filesModified': p.filesModified.length,
  })
  .catch(() => {});
```
No `content` or `locations` fields are passed. The `WorkCompletePayload` has `filesModified: string[]` which could populate `locations`.

Same pattern at fix-complete (lines 212-217) and review-complete (lines 197-203) — all emit only `_meta` fields, no `content` or `locations`.

### ACP Spec Check
KB-06 lines 55-80 show the `tool_call_update` example with `content` and `locations` fields on completed updates:
```json
"content": [
  { "type": "text", "text": "File contents: {...}" }
],
"locations": [
  { "path": "/home/user/project/config.json", "startLine": 1, "endLine": 45 }
]
```
KB-06 line 125: `locations?: FileLocation[]; // File locations affected`

While `content` and `locations` are typed as optional, the spec example shows them present on completed updates, and omitting them means clients cannot display tool output.

### Verdict: CONFIRMED
All three completion handlers (work, review, fix) omit `content` and `locations` fields. The data to populate these fields is available in the event payloads (e.g., `filesModified`, `score`, `resolvedIssues`) but is not passed through.

## Remediation
1. Add `content` arrays to completed `tool_call_update` emissions with descriptive text output
2. For work-complete: include `locations` from `filesModified` paths
3. For review-complete: include `content` with score details and pass/fail status as text
4. For fix-complete: include `content` with resolved issues and `locations` for affected files
5. Update event payload types if additional data fields are needed from the orchestrator
