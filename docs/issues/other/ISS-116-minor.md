# ISS-116 — Review Scoring Dimension Names Differ From GoodVibes Review Skill Framework

**Severity**: Minor
**File**: src/plugins/review/scoring.ts:24-35
**KB Topic**: Tools & MCP

## Original Issue

**[src/plugins/review/scoring.ts:24-35]** Dimension names/weights differ from the 10-Category Framework defined in the review skill. Align or document deviation. *(Tools & MCP)*

## Verification

### Source Code Check

`scoring.ts` lines 24-35 defines `REVIEW_DIMENSIONS`:

```typescript
export const REVIEW_DIMENSIONS: ReviewDimensionConfig[] = [
  { name: 'correctness',     weight: 0.15, description: 'Does the code work correctly?' },
  { name: 'architecture',    weight: 0.12, description: 'Proper layer boundaries and patterns?' },
  { name: 'error-handling',  weight: 0.12, description: 'Robust error handling, no-throw contracts?' },
  { name: 'type-safety',     weight: 0.10, description: 'Strict types, no any leaks?' },
  { name: 'security',        weight: 0.12, description: 'No secrets, no injection, capability gating?' },
  { name: 'performance',     weight: 0.08, description: 'No N+1, proper async, no unnecessary allocs?' },
  { name: 'maintainability', weight: 0.08, description: 'Clear naming, good organization, DRY?' },
  { name: 'completeness',    weight: 0.10, description: 'All requirements implemented?' },
  { name: 'testing-surface', weight: 0.07, description: 'Public APIs testable via DI?' },
  { name: 'documentation',   weight: 0.06, description: 'JSDoc on public APIs, module headers?' },
];
```

This is a GoodVibes-internal code review rubric. The weights sum to 1.00 (0.15+0.12+0.12+0.10+0.12+0.08+0.08+0.10+0.07+0.06 = 1.00). The framework is internally consistent.

### ACP Spec Check

The ACP spec (`agentclientprotocol.com/llms-full.txt`, all 10 KB files) has no concept of a "review skill 10-Category Framework" or code review dimensions. The ACP protocol covers agent-client communication: initialization, sessions, prompt turns, permissions, tools, filesystem, and terminal. Code review rubrics are entirely outside the protocol scope.

The issue references the "review skill" — a GoodVibes-internal skill (`scripts/skills/review/` or similar) that defines its own 10 categories. Any mismatch between `scoring.ts` and that skill is a GoodVibes internal consistency issue, not an ACP compliance issue.

### Verdict: NOT_ACP_ISSUE

This issue has nothing to do with ACP protocol compliance. The `scoring.ts` file defines a code review rubric used by the WRFC orchestrator — this is a GoodVibes implementation detail. Whether its dimension names match the GoodVibes review skill's categories is a GoodVibes internal consistency question.

The KB topic attribution "Tools & MCP" is also incorrect — code review scoring is unrelated to MCP.

## Remediation

N/A — not an ACP compliance issue.

For internal consistency: compare `REVIEW_DIMENSIONS` in `scoring.ts` against the GoodVibes review skill's category definitions and either align them or add a comment explaining the intentional deviation.
