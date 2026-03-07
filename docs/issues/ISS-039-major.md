# ISS-039: Agent status to ToolCallStatus mappings use wrong values

**Severity**: Major
**File**: src/extensions/acp/agent-event-bridge.ts
**Line(s)**: 83-87
**Topic**: Prompt Turn

## Issue Description
Agent `'failed'` status maps to `ToolCallStatus 'failed'` but spec defines the value as `'error'`. Also, `'cancelled'` maps to `'failed'` — it should map to `'cancelled'` (a valid spec status). Fix both mappings.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/04-prompt-turn.md, line 207
- **Spec Says**: `type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error"`. There is no `'failed'` status in the spec. The valid terminal error status is `'error'`, and `'cancelled'` is a distinct valid status.
- **Confirmed**: Yes
- **Notes**: `'failed'` is not a valid ToolCallStatus value per the ACP spec.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: At lines 83-87, the status mapping is:
  - `to === 'running'` -> `'in_progress'` (correct)
  - `to === 'completed'` -> `'completed'` (correct)
  - `to === 'failed' || to === 'cancelled'` -> `'failed'` (WRONG: both map to non-existent `'failed'`)
  The `'failed'` agent status should map to `'error'`, and `'cancelled'` should map to `'cancelled'`.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Change the mapping to: `to === 'failed' ? 'error' : to === 'cancelled' ? 'cancelled' : ...`
2. Specifically: `to === 'failed'` -> `'error'` and `to === 'cancelled'` -> `'cancelled'`
3. Verify there are no other places that emit `'failed'` as a ToolCallStatus
