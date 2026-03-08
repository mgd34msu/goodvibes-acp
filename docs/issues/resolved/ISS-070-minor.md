# ISS-070 — Hook Validation Pre-Hook Cannot Abort Operations — Advisory Only

**Severity**: Minor
**File**: src/extensions/hooks/registrar.ts:52-62
**KB Topic**: Overview — Permission System (01-overview.md lines 25, 147, 224)

## Original Issue
The `agent:spawn` pre-hook sets `_validationError` on context when validation fails, but the HookEngine has no mechanism to abort the operation. The spawn proceeds regardless.

## Verification

### Source Code Check
Lines 52-62 of `src/extensions/hooks/registrar.ts`:
```typescript
    engine.register(
      'agent:spawn',
      'pre',
      (context: Record<string, unknown>) => {
        const validation = validateAgentConfig(context as HookContext);
        if (!validation.proceed) {
          return { ...context, _validationError: validation.reason };
        }
        return context;
      }
    );
```

When validation fails (`!validation.proceed`), the hook returns the context with a `_validationError` property added. However, the hook engine continues the pipeline regardless.

From `src/core/hook-engine.ts` (line 56):
```
 * - Error in one hook does not stop others (error isolation)
```

The hook engine is explicitly designed to never abort. Setting `_validationError` on the context is purely advisory — downstream code would need to manually check for it, but there is no indication that it does.

### ACP Spec Check
KB-01 defines `session/request_permission` as the native permission flow. The hook system is a project-internal mechanism. However, the principle that validation failures should be actionable is sound — a pre-hook that cannot prevent an invalid operation from proceeding defeats the purpose of pre-validation.

### Verdict: CONFIRMED
The `agent:spawn` pre-hook cannot actually prevent a spawn from proceeding when validation fails. The `_validationError` metadata is set on the context but the hook engine's error-isolation design means the operation continues regardless. This makes the validation purely advisory with no enforcement mechanism.

## Remediation
1. Add an abort mechanism to `HookEngine` — e.g., if a pre-hook returns a context with `_abort: true`, the engine should throw or return early before the main operation executes
2. Alternatively, have the spawn logic explicitly check for `_validationError` on the context after pre-hooks run and abort if present
3. Document whether pre-hooks are advisory or enforceable — if advisory by design, rename from "validation" to something like "enrichment" to set correct expectations
