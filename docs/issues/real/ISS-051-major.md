# ISS-051 — No input validation in `_dispatch` before type casting

**Severity**: Major
**File**: `src/plugins/project/analyzer.ts`
**KB Topic**: KB-06: Tool Input Validation

## Original Issue
The `_dispatch` method casts `params` to typed params without validating that required fields exist. If `projectRoot` is missing, `undefined` is passed to `join()` producing a malformed path. The tool definitions declare `projectRoot` as required but the runtime never enforces this.

## Verification

### Source Code Check
At line 245, `_dispatch` does:
```typescript
const p = params as Record<string, unknown>;
```
Then for some branches like `project_deps_analyze` (line 250):
```typescript
const args = p as AnalyzeDepsParams;
return this._deps.analyze(args.projectRoot, { ... });
```
No validation that `args.projectRoot` exists before use. Other branches use `String(p['projectRoot'] ?? '')` which provides a graceful fallback to empty string, but the typed-cast branches skip validation entirely.

### ACP Spec Check
KB-06 defines tool call handling with input parameters. While the KB doesn't explicitly mandate runtime input validation, the tool definitions declare `projectRoot` as required. Accepting invalid inputs that produce malformed paths is a robustness issue that could cause confusing downstream failures.

### Verdict: CONFIRMED
The code does cast `params` to typed interfaces without runtime validation. Required fields like `projectRoot` are not checked before use in the typed-cast branches, risking `undefined` propagation into path operations.

## Remediation
1. Add a validation guard at the top of `_dispatch` that checks for the presence of `projectRoot` (and any other required fields) before dispatching.
2. Return a structured error result if required fields are missing, rather than allowing `undefined` to propagate.
3. Consider using the Zod schemas from the SDK or a lightweight check function to validate inputs.
