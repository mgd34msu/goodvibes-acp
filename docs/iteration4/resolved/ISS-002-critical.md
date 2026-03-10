# ISS-002 — ToolCallStatus uses 'error' instead of SDK's 'failed'
**Severity**: Critical
**File**: `src/extensions/hooks/registrar.ts`
**KB Topic**: KB-06, KB-09: Tool Calls

## Original Issue
The SDK defines `ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'`. The codebase uses `'running'` (from KB-06 prose) and `'error'` (hooks registrar) instead. Any runtime code emitting these non-standard values produces non-compliant ACP wire messages.

## Verification

### Source Code Check
`src/extensions/hooks/registrar.ts` line 205 emits:
```
status: failed ? 'error' : 'completed',
```
This emits `'error'` which is not a valid SDK ToolCallStatus value.

Regarding `'running'`: it appears in `AgentStatus` and `TaskStatus` types (internal lifecycle tracking), and a comment in `tool-call-bridge.ts` (line 47) acknowledges the KB-06 discrepancy. No code was found directly emitting `'running'` as a ToolCallStatus on the ACP wire.

### ACP Spec Check
SDK `ToolCallStatus` (types.gen.d.ts:2963):
```
type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";
```

KB-04 uses `"pending" | "in_progress" | "completed" | "cancelled" | "error"` (differs from SDK).
KB-06 uses `"pending" | "running" | "completed" | "failed"` (also differs from SDK).

SDK is authoritative per task context.

### Verdict: CONFIRMED
The registrar emits `'error'` where the SDK requires `'failed'`. This produces non-compliant wire messages. The `'running'` claim is partially confirmed via KB-06 prose influence, though no direct wire emission of `'running'` was found in the ACP tool call path.

## Remediation
1. Change `'error'` to `'failed'` in `src/extensions/hooks/registrar.ts` line 205.
2. Define a canonical `ToolCallStatus` type alias re-exporting the SDK type.
3. Audit all ACP wire emission sites to ensure only SDK-valid values are used.
