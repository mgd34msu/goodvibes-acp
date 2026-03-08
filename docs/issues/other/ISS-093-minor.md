# ISS-093 — `applyEnvOverrides` number coercion only matches integers

**Severity**: Minor  
**File**: `src/core/config.ts`  
**Lines**: 142  
**KB Reference**: None (internal quality concern)

## Description

The regex `/^\d+$/` in `applyEnvOverrides` only matches positive integers. Floating-point values like `GOODVIBES_WRFC__MIN_REVIEW_SCORE=9.5` will be treated as strings instead of numbers.

### Verdict: NOT_ACP_ISSUE

This is a pure internal configuration concern. `applyEnvOverrides` is a GoodVibes-specific config mechanism. The ACP spec does not define agent-internal config management. The issue references "KB-00" which does not exist.

Note: The default value for `wrfc.minReviewScore` is `9.5` (a float), so the env override mechanism cannot correctly override this value.

## Remediation

Still a valid code quality fix:

1. Update the regex and parser at line 142:
   ```typescript
   if (/^-?\d+(\.\d+)?$/.test(envValue)) {
     value = parseFloat(envValue);
   }
   ```
