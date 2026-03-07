# ISS-072: Reviewer retrieved via getAll() masks missing reviewer with score 10 fallback

**Severity**: Major
**File**: src/main.ts
**Line(s)**: 239-249
**Topic**: Implementation Guide

## Issue Description
Reviewer retrieved via `registry.getAll<IReviewer>('reviewer')` with first-value extraction. Spec uses single-value `registry.get<IReviewer>('reviewer')`. Using `getAll` masks a missing reviewer (falls back to score 10).

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/10-implementation-guide.md, Section 6 (WRFC as Tool Calls)
- **Spec Says**: The implementation guide shows `const reviewer = this.registry.get<IReviewer>('reviewer')` (single-value retrieval, line 445). The reviewer is expected to be a registered singleton.
- **Confirmed**: Yes
- **Notes**: Using `getAll` and extracting `.values().next().value` is a multi-provider pattern that silently degrades when no reviewer is registered.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 239-249: `const reviewers = registry.getAll<IReviewer>('reviewer')` followed by `const reviewer = reviewers.values().next().value`. If `reviewer` is undefined, it returns a fake `ReviewResult` with `score: 10` and `notes: 'No reviewer configured'`. This means WRFC always passes review when no reviewer plugin is loaded.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Replace `registry.getAll<IReviewer>('reviewer')` with `registry.get<IReviewer>('reviewer')`
2. If no reviewer is registered, either throw an error or emit a warning via the event bus rather than silently returning score 10
3. At minimum, log a warning when falling back to the no-reviewer path so operators know the WRFC loop is effectively disabled
