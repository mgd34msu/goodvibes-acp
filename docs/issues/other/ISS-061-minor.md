# ISS-061 — computeWeightedScore runtime function in L0 pure-types module

**Severity**: Minor
**File**: `src/types/review-scoring.ts`
**KB Topic**: KB-00: Layer Discipline

## Original Issue
The module header declares `@layer L0 -- pure types, no runtime code, no imports` but `computeWeightedScore` is a runtime function. Constants are exempted per `constants.ts`, but executable functions are not.

## Verification

### Source Code Check
The file `src/types/review-scoring.ts` has a module header at line 3 declaring `@layer L0 — pure types, no runtime code, no imports`. At line 62, `computeWeightedScore` is an exported function that performs runtime computation (iterating over dimensions, summing weighted scores). This is indeed a runtime function, not a type or constant.

### ACP Spec Check
KB-00/KB-10 mention layer discipline (L0 for pure types, L1 for core, L2 for extensions). However, layer discipline is an internal architectural convention of the goodvibes project, not an ACP protocol requirement. The ACP spec does not define or enforce layer boundaries.

### Verdict: NOT_ACP_ISSUE
While the observation is correct — a runtime function exists in a self-declared pure-types module — this is an internal code organization concern, not an ACP compliance issue. Layer discipline is a project convention, not an ACP protocol requirement.

## Remediation
N/A — not an ACP compliance issue. However, for internal code quality, moving `computeWeightedScore` to an L1 or L2 utility module would honor the stated layer contract.
