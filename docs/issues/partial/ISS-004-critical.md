# ISS-004 — `tool_call_update` uses wrong status enum value `'failed'`

**Severity**: Critical
**File**: `src/extensions/hooks/registrar.ts`
**KB Topic**: KB-04: ToolCallStatus

## Original Issue
The post-hook emits `status: 'failed'` for permission-denied tool calls. The canonical ACP spec defines `ToolCallStatus` as `"pending" | "in_progress" | "completed" | "cancelled" | "error"`. The value `'failed'` is not a valid ACP status. The correct value for a permission-denied tool call is `'error'` (or `'cancelled'`).

## Verification

### Source Code Check
Line 195 of `src/extensions/hooks/registrar.ts`:
```typescript
status: failed ? 'failed' : 'completed',
```

The code uses `'failed'` as the error status.

### ACP Spec Check
KB-04 line 207 defines:
```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";
```

KB-06 line 114 defines a different set:
```typescript
type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';
```

The two KB sources disagree. KB-04 uses `in_progress`/`error`; KB-06 uses `running`/`failed`.

### Verdict: PARTIAL
The code uses `'failed'` which matches KB-06 but not KB-04. The KB sources are internally contradictory. KB-04 is the "Prompt Turn" reference which includes detailed TypeScript interfaces and is likely the more authoritative source for `ToolCallStatus`. KB-06 is the "Tools and MCP" reference with a simpler status set. The value `'failed'` is valid per KB-06 but not per KB-04. Given the ambiguity, the issue has merit but is overstated by claiming `'failed'` is categorically wrong.

## Remediation
1. Reconcile the two KB definitions to determine the canonical `ToolCallStatus` values.
2. If KB-04 is authoritative, change `'failed'` to `'error'` at line 195.
3. If KB-06 is authoritative, the code is correct and no change is needed.
4. Check the installed SDK types (`@agentclientprotocol/sdk`) to determine the actual TypeScript union the SDK expects.
