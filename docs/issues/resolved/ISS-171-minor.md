# ISS-171 — Internal `title` Field Mapped to `content` on Wire

**Severity**: Minor
**File**: src/extensions/acp/plan-emitter.ts:121-138
**KB Topic**: Prompt Turn

## Original Issue
Internal interface uses `title` mapped to `content` on emit. Rename `InternalPlanEntry.title` to `.content` for wire-format consistency.

## Verification

### Source Code Check
The `InternalPlanEntry` interface (lines 15-21) defines:
```typescript
interface InternalPlanEntry {
  id: string;
  /** Human-readable description sent as the ACP PlanEntry.content */
  title: string;
  status: acp.PlanEntryStatus;
  priority: acp.PlanEntryPriority;
}
```

In `emitPlan()` (lines 121-129), the mapping is:
```typescript
const planEntries: acp.PlanEntry[] = Array.from(this.entries.values()).map(
  (e): acp.PlanEntry => ({
    content: e.title,   // internal 'title' → wire 'content'
    priority: e.priority,
    status: e.status,
  }),
);
```

The wire format is correct — `content` is emitted per ACP spec. The internal field `title` is purely internal naming.

### ACP Spec Check
KB `04-prompt-turn.md` lines 250-254 show:
```typescript
interface PlanEntry {
  content: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
}
```

The wire field is `content`. The code correctly emits `content: e.title` — the mapping is explicit and documented in the JSDoc comment: "Human-readable description sent as the ACP PlanEntry.content".

### Verdict: NOT_ACP_ISSUE
The wire format is correct. `PlanEntry.content` is correctly emitted on the wire. The issue is purely an internal naming inconsistency — the private `InternalPlanEntry.title` field could be renamed to `.content` for clarity, but it does not cause any ACP protocol non-compliance. The JSDoc on the field already documents the mapping explicitly.

## Remediation
This is a code clarity improvement only, not an ACP fix:
- Rename `InternalPlanEntry.title` to `InternalPlanEntry.content`
- Update all internal usages: `entry.title = ...` → `entry.content = ...` and `e.title` → `e.content`
- Remove now-redundant JSDoc comment on the field
- The emit mapping becomes `content: e.content` (self-documenting)
