# ISS-161 — Default `intervalMs` of 60000 is a magic number repeated 3x

**Severity**: Nitpick  
**File**: `src/core/scheduler.ts`  
**Lines**: 84, 161, 222  
**KB Reference**: KB-00 (Code Quality) — no corresponding KB file exists

## Description

The fallback value `60000` for `intervalMs` appears three times in `scheduler.ts`:
- Line 84: `const intervalMs = config.intervalMs ?? 60000;`
- Line 161: `const intervalMs = task.config.intervalMs ?? 60000;`
- Line 222: `const intervalMs = task.config.intervalMs ?? 60000;`

The number is undocumented and repeated, making it fragile to change.

### Verdict: NOT_ACP_ISSUE

The magic number `60000` (1 minute) is confirmed present at all three locations cited. However, this is purely an internal code quality concern. The ACP specification does not define scheduler interval behavior, default polling intervals, or task timing constants. The referenced "KB-00: Code Quality" does not correspond to any ACP knowledgebase document. While extracting a named constant is good practice, this has no ACP compliance implications.

## Remediation

Optional improvement (not ACP-required):

1. Extract `60000` to a module-level constant: `const DEFAULT_INTERVAL_MS = 60_000;`
2. Replace all three occurrences with the named constant.
3. Add a JSDoc comment explaining the default value choice.
