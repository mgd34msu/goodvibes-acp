# ISS-147 — `GoodVibesMode` includes `'plan'` which is not in KB-10

**Severity**: nitpick
**File**: `src/extensions/acp/config-adapter.ts`
**Line**: 16
**KB Reference**: KB-10 (Mode Definitions)

## Issue Description

KB-10 references 3 modes (`justvibes`, `vibecoding`, `sandbox`) but the implementation adds a fourth mode `'plan'` that is not documented in the knowledgebase.

## Source Evidence

- `src/extensions/acp/config-adapter.ts` line 16: `export type GoodVibesMode = 'justvibes' | 'vibecoding' | 'sandbox' | 'plan';`
- KB-10 line 378 shows only `justvibes` referenced in example code; no mention of `plan` as a defined mode

### Verdict: CONFIRMED

The `'plan'` mode exists in the implementation but is undocumented in the knowledgebase. This is not a bug — it is a documentation gap.

## Remediation

1. Update KB-10 to document the `'plan'` mode, its purpose, and how it differs from the other three modes
2. Alternatively, add a code comment on line 16 explaining why `'plan'` is included and what it represents
