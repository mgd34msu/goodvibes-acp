# ISS-011 — Barrel export file missing review-scoring.ts re-export

**Severity**: Major
**File**: src/types/index.ts
**KB Topic**: KB-09: Module Completeness

## Original Issue
The barrel export file does not re-export `review-scoring.ts`. Any consumer importing from `@l0/index` will not have access to `REVIEW_DIMENSIONS`, `computeWeightedScore`, or related types. The barrel file's own documentation states it "Re-exports all L0 type definitions."

## Verification

### Source Code Check
`src/types/index.ts` (30 lines) re-exports 14 modules but does NOT include `review-scoring`. The file `src/types/review-scoring.ts` exists and exports types/constants. The barrel file's JSDoc says "Re-exports all L0 type definitions."

### ACP Spec Check
KB-09 (TypeScript SDK reference) does not define any "module completeness" requirement. This is not an ACP protocol compliance concern — ACP does not prescribe how internal modules are organized or barrel-exported.

### Verdict: NOT_ACP_ISSUE
The missing re-export is a real code quality problem — consumers of the barrel file will not get `review-scoring` types. However, ACP has no requirements about internal module organization or barrel exports. This is a project-level code completeness issue, not an ACP protocol compliance violation.

## Remediation
N/A
