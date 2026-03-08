# ISS-006 — MCP tool-call-bridge uses `'in_progress'` status instead of ACP spec `'running'`

**Severity**: Critical
**File**: `src/extensions/mcp/tool-call-bridge.ts`
**KB Topic**: KB-06: ToolCallStatus

## Original Issue
The code uses `'in_progress'` as the active execution status. The ACP wire protocol defines `'running'` (KB-06 line 114). A non-SDK ACP client receiving `'in_progress'` would not recognize it as a valid status. The ISS-055 comment acknowledges the SDK divergence.

## Verification

### Source Code Check
Line 109 of `src/extensions/mcp/tool-call-bridge.ts`:
```typescript
return emitter.emitToolCallUpdate(sessionId, toolCallId, 'in_progress');
```

The code uses `'in_progress'`.

### ACP Spec Check
KB-06 line 114 defines:
```typescript
type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';
```

KB-04 line 207 defines:
```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";
```

KB-04 line 175 shows a wire example using `"status": "in_progress"`.
KB-06 line 260 shows a wire example using `"status": "running"`.

The two KB sources are contradictory on this value.

### Verdict: PARTIAL
The code uses `'in_progress'` which matches KB-04 (the prompt turn reference) but not KB-06 (the tools/MCP reference). The KB sources are internally contradictory. KB-04 is arguably the more authoritative source as it contains the full TypeScript interface definitions and wire examples. The issue overstates the problem by claiming `'in_progress'` is wrong when it matches one of the two spec references.

## Remediation
1. Reconcile the KB-04 and KB-06 definitions of `ToolCallStatus`.
2. Check the installed SDK TypeScript types to determine which value the SDK actually uses.
3. If KB-06 is authoritative, change `'in_progress'` to `'running'`.
4. If KB-04 is authoritative, the code is correct.
5. Consider that the SDK may map between internal and wire values — verify what actually goes on the wire.
