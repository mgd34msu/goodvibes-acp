# ISS-046 — getAnalyticsResponse ignores the scope discriminator

**Severity**: Minor
**File**: `src/plugins/analytics/engine.ts`
**KB Topic**: KB-08: Analytics Extension

## Original Issue
The `GoodVibesAnalyticsRequest` type defines `scope` as `'session' | 'workflow' | 'agent'` matching KB-08 wire format. However, `getAnalyticsResponse()` only reads `request?.sessionId` and completely ignores `scope` and `id`. The method signature promises scope support it cannot deliver.

## Verification

### Source Code Check
Lines 266-268 show the method signature accepts the full request type:
```typescript
getAnalyticsResponse(
  request?: GoodVibesAnalyticsRequest | { sessionId?: string }
): GoodVibesAnalyticsResponse {
```
Line 269 only extracts `sessionId`:
```typescript
const sessionId = request?.sessionId;
```
The `scope` and `id` fields from `GoodVibesAnalyticsRequest` are never referenced anywhere in the method body (lines 266-319). The JSDoc at lines 258-260 acknowledges this: "Workflow and agent scopes currently fall back to session-level data since per-workflow/agent tracking is not yet implemented."

### ACP Spec Check
KB-08 lines 303-310 define the wire format with `scope: 'session' | 'workflow' | 'agent'` and `id?: string`. The scope discriminator is part of the extension method contract.

### Verdict: CONFIRMED
The method accepts the typed request but ignores the `scope` and `id` fields entirely. While documented in the JSDoc, this creates a silent contract violation — callers requesting workflow or agent scope get session-level data without any indication of the fallback.

## Remediation
Either:
1. Dispatch on `scope` to provide scope-specific analytics (requires implementing per-workflow and per-agent tracking)
2. Or narrow the accepted type to `{ sessionId?: string }` only and reject requests with `scope !== 'session'` with an appropriate error, documenting the limitation
