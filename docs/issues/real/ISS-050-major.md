# ISS-050 — WRFC Reviewer Default `minScore` Is 9.5 — Spec Specifies 7.0

**Severity**: Major
**File**: src/plugins/review/reviewer.ts:43
**KB Topic**: WRFC Configuration (10-implementation-guide.md section 6, line 356)

## Original Issue
The default `minScore` is `9.5` but KB section 6 specifies `MIN_SCORE = 7.0`.

## Verification

### Source Code Check
At line 43:
```typescript
constructor(options?: CodeReviewerOptions) {
  this.minScore = options?.minScore ?? 9.5;
}
```
The fallback default is `9.5`.

### ACP Spec Check
KB-10 (line 356):
```typescript
const MIN_SCORE = 7.0;
```
This is defined in the WRFC orchestration loop reference implementation and represents the threshold at which a review passes.

### Verdict: CONFIRMED
The default `minScore` of `9.5` is significantly higher than the spec-defined `7.0`. At 9.5, virtually every first-pass implementation will fail review, triggering unnecessary fix cycles. This wastes tokens and time, directly contradicting the efficiency goals of the WRFC system. The value 9.5 appears to be an unreasonably strict default that does not match the spec.

## Remediation
1. Change the default to match the spec:
```typescript
constructor(options?: CodeReviewerOptions) {
  this.minScore = options?.minScore ?? 7.0;
}
```
2. Document that callers can override with a stricter threshold if desired.
3. Consider exposing the default as a named constant for discoverability.
