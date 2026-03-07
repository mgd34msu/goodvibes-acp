# ISS-174 — Hook `context` Parameter Typed as `Record<string, unknown>` Instead of `AgentConfig`

**Severity**: Minor
**File**: src/extensions/hooks/built-ins.ts:19
**KB Topic**: Permissions

## Original Issue
`context` parameter typed as `Record<string, unknown>` — loses type safety. Should use `AgentConfig`.

## Verification

### Source Code Check
`src/extensions/hooks/built-ins.ts` line 18-19:
```typescript
export function validateAgentConfig(
  context: Record<string, unknown>
): { proceed: boolean; reason?: string } {
```

The function validates required fields `['type', 'task', 'sessionId']` from `context`, but the parameter is typed as `Record<string, unknown>`. All hook functions in this file (`emitAgentSpawned`, `emitWrfcReviewScore`, `emitWrfcCompleted`, `emitSessionCreated`, `emitSessionDestroyed`) accept `context: Record<string, unknown>`.

### ACP Spec Check
This is purely a TypeScript type-safety concern. The ACP spec does not define the internal hook system or how agent configuration is typed. The `AgentConfig` type would be project-internal, not ACP-spec-derived. The KB topic attribution of "Permissions" appears incorrect for this issue — it is not related to the ACP permissions mechanism (`session/request_permission`).

### Verdict: NOT_ACP_ISSUE
The issue is real — `Record<string, unknown>` is less type-safe than a concrete `AgentConfig` type. However, this is purely a TypeScript type-safety improvement with no ACP protocol compliance implications. Using `Record<string, unknown>` does not cause any ACP wire format or protocol violations. The KB topic "Permissions" is also incorrect for this issue.

## Remediation
N/A for ACP compliance. For code quality:
- Import and use `AgentConfig` (or equivalent spawn-config type) as the parameter type for `validateAgentConfig`
- Similarly type the `context` parameter in the other hook functions according to the actual payload shape each receives
- This improves compile-time safety and makes field mismatches detectable at the call site rather than at runtime
