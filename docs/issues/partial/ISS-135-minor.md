# ISS-135: `PluginRegistration.register` typed as `(registry: unknown)` forces unsafe casts

**Source**: `src/types/plugin.ts` line 52; `src/plugins/skills/index.ts` line 34; `src/plugins/review/index.ts` line 30; `src/plugins/project/index.ts` line 77
**KB Reference**: KB-10 (Type Safety)
**Severity**: Minor

### Verdict: PARTIAL

The `PluginRegistration` type at `src/types/plugin.ts:52` defines `register: (registry: unknown) => void`. All three referenced plugins (`skills`, `review`, `project`) cast `registry` from `unknown` to `Registry` without runtime validation.

However, this is a **deliberate architectural decision**, documented in the comments at lines 41-43: "The actual registry type is defined in L1 and not imported here. The `registry` parameter uses `unknown` -- L1 will cast it appropriately when calling register()."

The `unknown` type prevents a circular dependency between L0 (pure types) and L1 (runtime). This is a valid layering concern. The issue is real (unsafe casts exist) but the root cause is an intentional design tradeoff, not an oversight.

### Remediation

1. Define a minimal `IRegistry` interface in L0 (`src/types/registry.ts`) with `register()` and `registerMany()` signatures
2. Update `PluginRegistration.register` to accept `IRegistry` instead of `unknown`
3. Have the L1 `Registry` class implement `IRegistry`, eliminating the need for casts while preserving layer separation
