# ISS-104 — `tool_call_update` uses wrong status enum value `'failed'`

**Severity**: Critical  
**File**: `src/extensions/hooks/registrar.ts`  
**Line**: 195  
**KB Reference**: KB-04 (ToolCallStatus), KB-06 (ToolCallStatus)  
**Iteration**: 3

## Description

The post-hook emits `status: 'failed'` for permission-denied tool calls. KB-04 defines `ToolCallStatus` as `"pending" | "in_progress" | "completed" | "cancelled" | "error"`, which does not include `'failed'`. KB-06 defines a different set: `pending | running | completed | failed`.

The two KB files disagree on the valid status values. Per the known context note, the SDK types should be treated as authoritative when KB-04 and KB-06 conflict.

## Source Evidence

```typescript
// src/extensions/hooks/registrar.ts:195
status: failed ? 'failed' : 'completed',
```

## Spec Evidence

KB-04 (TypeScript interface):
```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";
```

KB-06 (lifecycle diagram):
```
pending → running → completed
                  → failed
```

### Verdict: PARTIAL

KB-04 and KB-06 define `ToolCallStatus` differently. KB-04 uses `error` (no `failed`), KB-06 uses `failed` (no `error`). The code uses `'failed'` which aligns with KB-06 but not KB-04. For a permission-denied tool call, `'cancelled'` may be more semantically correct than either `'failed'` or `'error'`. The SDK TypeScript types should be checked to determine the authoritative set.

## Remediation

1. Check the actual SDK `ToolCallStatus` type definition to determine which values are valid
2. If SDK matches KB-04: change `'failed'` to `'error'` (or `'cancelled'` for permission denials)
3. If SDK matches KB-06: `'failed'` is correct per the SDK, but consider using `'cancelled'` for permission-denied cases specifically, as it is more semantically accurate
4. Add a code comment documenting which KB source was followed and why
