# ISS-094 — `can()` does not evaluate guards but name implies it does

**Severity**: Minor  
**File**: `src/core/state-machine.ts`  
**Lines**: 243-250  
**KB Reference**: None (internal quality concern)

## Description

The `can()` method checks if a transition exists structurally but ignores guard conditions. The JSDoc explicitly states "Does NOT fire guards" but the method name `can()` implies capability checking including guards.

### Verdict: NOT_ACP_ISSUE

This is an internal state machine API design concern. The state machine is a GoodVibes L1 core primitive, not an ACP-defined construct. The JSDoc correctly documents the behavior. The issue references "KB-02" which is about ACP initialization, not internal state machine semantics.

The code is functionally correct and well-documented. The naming is a matter of API design preference.

## Remediation

Optional improvement:

1. Consider adding `canStrict(event: string): boolean` that evaluates guards, or
2. Rename `can()` to `hasTransition()` for clarity.
