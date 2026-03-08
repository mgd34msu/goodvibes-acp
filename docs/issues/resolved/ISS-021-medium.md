# ISS-021: HookEngine lacks abort/short-circuit mechanism for pre-hooks

**Source**: `src/core/hook-engine.ts` (lines 167-184)
**KB Reference**: KB-08: Extensibility
**Severity**: Medium

### Verdict: PARTIAL

**Finding**: The `HookEngine.execute()` method iterates through all pre-hooks in a `for` loop without checking for an abort signal between iterations. If a pre-hook sets `_meta._abort = true`, subsequent pre-hooks still execute. This is a real design gap.

**However**, KB-08 does not mandate an abort/short-circuit mechanism for pre-hooks. The knowledgebase mentions extensibility and hook registration but does not prescribe abort semantics. The issue is a valid defensive-programming concern but overstates its connection to ACP compliance.

### Remediation

1. After each pre-hook execution, check if the returned context contains `_meta._abort === true`
2. If abort is detected, break the loop and return the current context immediately
3. Document this convention in the hook registration API

```typescript
for (const entry of entries) {
  try {
    const result = await (entry as HookEntry<T>).preHandler?.(current);
    if (result !== undefined && result !== null) {
      current = result as T;
    }
    // Short-circuit on abort signal
    if ((current as any)?._meta?._abort) break;
  } catch (err) {
    console.warn(`[HookEngine] Pre-hook failed at '${hookPoint}':`, err);
  }
}
```
