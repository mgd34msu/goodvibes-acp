# ISS-129 — Logs manager has no session scoping — entries cannot be attributed to sessions

**Severity**: Minor
**File**: `src/extensions/logs/manager.ts`
**Lines**: 22-59
**KB Topic**: KB-03: Session Context

## Original Issue
`ActivityEntry`, `DecisionEntry`, and `ErrorEntry` have no `sessionId` field. For a multi-session agent, logs become undifferentiated.

## Verification

### Source Code Check
Confirmed in manager.ts:

`ActivityEntry` (lines 22-31):
```typescript
export type ActivityEntry = {
  title: string;
  task: string;
  plan?: string;
  status: 'COMPLETE' | 'PARTIAL' | 'IN_PROGRESS';
  completedItems: string[];
  filesModified: string[];
  reviewScore?: number;
  commit?: string;
};
```

`DecisionEntry` (lines 33-40) and `ErrorEntry` (lines 42-59) similarly lack any `sessionId` field.

None of the three entry types include session identification.

### ACP Spec Check
KB-03 defines sessions as the fundamental unit of interaction in ACP. Each session has a `sessionId`. In a multi-session agent, logs without session attribution cannot be correlated to specific user interactions, making debugging and auditing difficult.

### Verdict: CONFIRMED
All three log entry types lack `sessionId`. For an ACP agent that supports multiple concurrent sessions, this makes log attribution impossible.

## Remediation
1. Add `sessionId?: string` to `ActivityEntry`, `DecisionEntry`, and `ErrorEntry` types.
2. Update `logActivity()`, `logDecision()`, and `logError()` to accept and write the sessionId.
3. Include `sessionId` in the formatted Markdown output (e.g., `**Session**: ${e.sessionId ?? 'unknown'}`).
4. The field should be optional (`?`) to maintain backward compatibility with existing callers.
