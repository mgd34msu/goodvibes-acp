# ISS-043 — `_goodvibes/analytics` Handler Missing `scope` Parameter

**Severity**: Major
**File**: src/plugins/analytics/engine.ts:260-273
**KB Topic**: Extension Methods — `_goodvibes/analytics` Wire Format (08-extensibility.md lines 306-324)

## Original Issue
`getAnalyticsResponse()` only accepts an optional `sessionId`. It cannot handle `scope: 'workflow'` or `scope: 'agent'` queries as the spec mandates.

## Verification

### Source Code Check
At lines 260-273, the method signature is:
```typescript
getAnalyticsResponse(
  sessionId?: string
): {
  tokenUsage: { input: number; output: number; total: number; budget?: number; remaining?: number; };
  turnCount: number;
  agentCount: number;
  duration_ms: number;
}
```
The method only accepts an optional `sessionId` and always returns session-level analytics. There is no `scope` parameter and no `id` parameter for workflow/agent scoping.

### ACP Spec Check
KB-08 (lines 306-310) defines the wire format:
```typescript
interface GoodVibesAnalyticsRequest {
  sessionId: string;
  scope: 'session' | 'workflow' | 'agent';
  id?: string;  // workflowId or agentId when scope != 'session'
}
```
The `scope` field is required (not optional) in the request, and the implementation must support all three scope values.

### Verdict: CONFIRMED
The implementation only handles session-scoped analytics. The `scope` and `id` parameters from the ACP-defined `GoodVibesAnalyticsRequest` interface are completely absent, making workflow-scoped and agent-scoped analytics queries impossible.

## Remediation
1. Update `getAnalyticsResponse()` to accept `{ sessionId: string; scope: 'session' | 'workflow' | 'agent'; id?: string }`.
2. Implement workflow-level and agent-level analytics aggregation.
3. Add internal tracking structures for per-workflow and per-agent token usage.
4. Validate that `id` is provided when `scope` is `'workflow'` or `'agent'`.
