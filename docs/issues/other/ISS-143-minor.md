# ISS-143 — TriggerEngine Recompiles RegExp on Every Event Evaluation

**Severity**: Minor
**File**: src/core/trigger-engine.ts
**KB Topic**: Overview

## Original Issue
Regex pattern creates new `RegExp` on every event evaluation. `TriggerEngine` subscribes to `*`, making this wasteful. Compile and cache at registration time.

## Verification

### Source Code Check
Lines 40–48 of `src/core/trigger-engine.ts` (the `matchesPattern` function):

```typescript
if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
  const regexStr = pattern.slice(1, -1);
  try {
    return new RegExp(regexStr).test(eventType);
  } catch {
    return false;
  }
}
```

Every call to `matchesPattern` with a regex-format pattern constructs a new `RegExp` object. Since `TriggerEngine` subscribes to all events (`*`), `matchesPattern` is called for every event against every registered pattern. With N triggers and E events, this results in N×E `RegExp` constructions when regex patterns are used.

### ACP Spec Check
The ACP spec does not define requirements for internal event routing performance. This is entirely an internal L1 core implementation concern. The spec is silent on how agents implement event pattern matching.

### Verdict: NOT_ACP_ISSUE
The code has the problem described — regex patterns are indeed recompiled on every evaluation. This is a genuine performance issue, particularly under high event volume. However, it has no bearing on ACP protocol compliance. The fix is straightforward (cache compiled regexes at registration time) but this is a code quality/performance issue, not an ACP issue.

## Remediation
Cache compiled `RegExp` objects at trigger registration time:

```typescript
// In the trigger registration logic, compile once:
const compiled = pattern.startsWith('/') && pattern.endsWith('/')
  ? new RegExp(pattern.slice(1, -1))
  : null;
// Store alongside the trigger config.
// In matchesPattern, use precompiled regex if available.
```

Alternatively, add a module-level `Map<string, RegExp>` cache keyed by pattern string.
