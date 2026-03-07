# ISS-188 — WRFC Orchestrator Always Spawns `'engineer'` Agent Type

**Severity**: Nitpick
**File**: `src/extensions/wrfc/orchestrator.ts:165-168`
**KB Topic**: Implementation Guide

## Original Issue
`[src/extensions/wrfc/orchestrator.ts:165-168]` Agent config hardcodes type as `'engineer'` for initial spawn. Spec uses `'engineer'` for attempt 1 and `'fixer'` for subsequent. Document as intentional design decision. *(Implementation Guide)*

## Verification

### Source Code Check
Lines 165–168 of `src/extensions/wrfc/orchestrator.ts`:
```typescript
const agentConfig: AgentConfig = {
  type: 'engineer',
  task,
  sessionId,
};
```
The `type` is hardcoded as `'engineer'` unconditionally, regardless of which retry attempt is being made.

### ACP Spec Check
From KB 10 — Implementation Guide, the WRFC section shows:
```typescript
type: attempt === 1 ? 'engineer' : 'fixer',
```
The spec explicitly distinguishes between `'engineer'` (first attempt) and `'fixer'` (subsequent attempts). The `'fixer'` agent type is a protocol-level concept for the WRFC (Work-Review-Feedback-Correct) loop — it receives prior output and feedback to produce a corrected result.

### Verdict: CONFIRMED
The implementation deviates from the spec's WRFC pattern: it always uses `'engineer'` regardless of attempt count, losing the semantic distinction between initial work and correction passes. This means the `'fixer'` agent type is never used, and subsequent WRFC attempts cannot leverage a specialized fixer prompt or behavior.

However, the severity is correctly rated Nitpick because: (1) the WRFC loop may not currently retry (needs verification), (2) this is a behavioral/semantic gap rather than a wire format compliance issue, and (3) the issue itself suggests "document as intentional design decision" as an acceptable resolution.

## Remediation
1. Check whether `WRFCOrchestrator` has retry logic. If it does, update the agent config:
```typescript
const agentConfig: AgentConfig = {
  type: attempt === 1 ? 'engineer' : 'fixer',
  task,
  sessionId,
};
```
2. If there is no retry loop, add a JSDoc comment explaining this is intentional:
```typescript
// Always 'engineer' — WRFC retry/fixer loop is not yet implemented.
const agentConfig: AgentConfig = {
  type: 'engineer',
  task,
  sessionId,
};
```
