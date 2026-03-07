# ISS-077: Env var path mapping incorrect for multi-segment keys

**Severity**: Major
**File**: src/core/config.ts
**Line(s)**: 146-149
**Topic**: Overview

## Issue Description
`GOODVIBES_AGENTS_MAX_PARALLEL` maps to `agents.max.parallel` instead of `agents.maxParallel`. Silent misconfiguration.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/01-overview.md (general agent configuration)
- **Spec Says**: The ACP spec does not prescribe internal configuration formats, but config correctness is fundamental to agent behavior. Misconfigured values (e.g., `agents.max.parallel` resolving to a nonexistent path instead of `agents.maxParallel`) mean environment-based configuration silently fails.
- **Confirmed**: Partial (not a direct ACP spec issue, but impacts ACP agent behavior)
- **Notes**: This is a code correctness bug rather than an ACP protocol conformance issue.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 148-149: `.replace(/_([a-z])/g, (_, c: string) => \`.\${c}\`)`. This regex replaces every `_` followed by a lowercase letter with `.` + that letter. So `AGENTS_MAX_PARALLEL` (after prefix removal) becomes `agents.max.parallel` — inserting dots at every underscore-letter boundary. The intent was likely camelCase conversion (`_m` -> `M`) combined with section separation, but the regex does neither correctly.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Define a clear convention: single underscore = camelCase boundary, double underscore = object nesting. E.g., `GOODVIBES_AGENTS__MAX_PARALLEL` -> `agents.maxParallel`
2. Or use a simpler approach: `GOODVIBES_AGENTS_MAX_PARALLEL` -> first segment is section (`agents`), remainder is camelCase key (`maxParallel`)
3. Fix the regex to: split on `__` for nesting, then camelCase within each segment
4. Add unit tests covering multi-segment env var names
