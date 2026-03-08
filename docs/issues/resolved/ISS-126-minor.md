# ISS-126 — Shared mutable regex state in concurrent `Promise.all`

**Severity**: Minor
**File**: `src/plugins/project/security.ts`
**Lines**: 287-316
**KB Topic**: KB-06: Concurrent Execution

## Original Issue
`Promise.all` over files uses shared `/g` regex patterns. Though unlikely in Node.js single-threaded execution, the pattern is fragile.

## Verification

### Source Code Check
The SECRET_PATTERNS array (lines 25-80) defines regex patterns with `/g` flags (e.g., `/AKIA[0-9A-Z]{16}/g` at line 28).

However, the code at line 303 explicitly resets `lastIndex` before each use:
```typescript
secretPattern.pattern.lastIndex = 0;
if (secretPattern.pattern.test(line)) {
```

The `lastIndex = 0` reset happens synchronously before `.test()`. In Node.js's single-threaded event loop, no other code can execute between these two lines. The `Promise.all` creates concurrent async operations, but each `await` point is the `readFile` call (line 293), not the regex operations. The regex matching loop (lines 299-314) runs synchronously within each iteration.

### ACP Spec Check
KB-06 discusses concurrent execution patterns. While the `/g` flag on shared regex objects is a known footgun in JavaScript, the explicit `lastIndex = 0` reset makes this code safe in practice.

### Verdict: PARTIAL
The code IS safe due to the explicit `lastIndex = 0` reset before each `.test()` call. The issue correctly identifies a fragile pattern (shared mutable `/g` regexes in concurrent code), but the mitigation is already in place. The pattern could be made more robust by removing the `/g` flag entirely (since `.test()` on a single line does not need global matching) or by creating fresh RegExp instances per iteration.

## Remediation
1. Remove the `/g` flag from all SECRET_PATTERNS regex definitions since `.test()` against individual lines does not require global matching.
2. Alternatively, use `String.prototype.match()` or `RegExp.prototype.test()` without the `/g` flag.
3. This eliminates the need for the `lastIndex = 0` reset entirely.
