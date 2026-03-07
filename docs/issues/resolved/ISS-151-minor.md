# ISS-151 — Missing Null Guard on `agentResult.errors` Array

**Severity**: Minor
**File**: `src/extensions/wrfc/orchestrator.ts:182`
**KB Topic**: Prompt Turn

## Original Issue
`agentResult.errors.map((e) => e.message ?? ...)` assumes error shape without null guard on array.

## Verification

### Source Code Check
Line 182 of `orchestrator.ts`:
```typescript
errors: agentResult.errors.map((e) => e.message ?? `Unknown error (code: ${e.code})`),
```

The `??` operator guards against individual `e.message` being null/undefined, but `.map()` is called directly on `agentResult.errors`. If `agentResult.errors` is `null`, `undefined`, or not present on the result object, this will throw a `TypeError: Cannot read properties of undefined (reading 'map')`.

### ACP Spec Check
The ACP spec (KB: Prompt Turn, `04-prompt-turn.md`) defines session/prompt result as:
```typescript
interface SessionPromptResult {
  stopReason: StopReason;
}
```
The `errors` field on agent results is internal to the WRFC implementation, not part of the ACP wire format. The spec does not prescribe the shape of internal orchestrator result objects.

### Verdict: NOT_ACP_ISSUE
The bug is real — calling `.map()` on a potentially absent array is a defensive programming gap. However, `agentResult` is an internal WRFC orchestration type, not an ACP protocol object. The ACP spec has no opinion on how internal agent result shapes are structured. This is a TypeScript robustness issue, not an ACP compliance violation.

## Remediation
N/A for ACP compliance. As a code quality fix:
```typescript
errors: (agentResult.errors ?? []).map((e) => e.message ?? `Unknown error (code: ${e.code})`),
```
