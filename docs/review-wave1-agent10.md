# Wave 1 Review — Agent 10: Config & Initialization

**Reviewer:** goodvibes:reviewer  
**Scope:** `src/core/config.ts`, `src/extensions/acp/config-adapter.ts`, `src/types/config.ts`, `index.ts`  
**KB Sources:** `02-initialization.md`, `10-implementation-guide.md`  
**ACP Spec:** Fetched from `https://agentclientprotocol.com/llms-full.txt`  
**SDK Version:** `@agentclientprotocol/sdk` v0.15.0  

---

## Summary

The config and initialization layer is well-structured with clean layering (L0 types, L1 core, L2 adapter). The `Config` class provides layered configuration with defaults, file, env, and runtime overrides. The ACP config-adapter correctly uses SDK schema types. However, the L0 `SessionConfigOptionChoice` type diverges from the SDK's `SessionConfigSelectOption` shape, the L0 type system declares unsupported config option types, and the config-adapter's default mode contradicts the implementation guide.

---

## Issues

### Issue 1 — L0 `SessionConfigOptionChoice.label` contradicts SDK `SessionConfigSelectOption.name`

| Field | Value |
|-------|-------|
| **File** | `src/types/config.ts` |
| **Line** | 80 |
| **Severity** | Major |
| **KB Topic** | KB-10 Section 9, ACP SDK `SessionConfigSelectOption` |

The L0 type defines `label?: string` (optional) but the SDK type `SessionConfigSelectOption` uses `name: string` (required). This means any code using the L0 type to build config options would produce objects missing the required `name` field.

**SDK definition** (`schema/types.gen.d.ts:2210`):
```typescript
export type SessionConfigSelectOption = {
  name: string;          // required
  value: SessionConfigValueId;
  description?: string | null;
  _meta?: { [key: string]: unknown } | null;
};
```

**Current L0 type:**
```typescript
export type SessionConfigOptionChoice = {
  value: string;
  label?: string;   // wrong field name, wrong optionality
  description?: string;
};
```

**Fix:** Rename `label` to `name` and make it required to match the SDK.

---

### Issue 2 — L0 `SessionConfigOptionType` declares unsupported types

| Field | Value |
|-------|-------|
| **File** | `src/types/config.ts` |
| **Line** | 89 |
| **Severity** | Major |
| **KB Topic** | ACP SDK `SessionConfigOption` type |

The L0 type declares `'select' | 'boolean' | 'text'` but the SDK's `SessionConfigOption` is defined as `SessionConfigSelect & { type: "select" }`. The ACP spec only supports `type: "select"` — there is no `'boolean'` or `'text'` config option type. The comment on line 88 (`@remarks All three types are natively supported by the ACP spec`) is factually incorrect.

**Fix:** Either restrict to `type: 'select'` to match the spec, or clearly document that `'boolean'` and `'text'` are GoodVibes-internal extensions that must be serialized as `'select'` on the wire.

---

### Issue 3 — `buildConfigOptions` default mode contradicts KB-10

| Field | Value |
|-------|-------|
| **File** | `src/extensions/acp/config-adapter.ts` |
| **Line** | 39 |
| **Severity** | Minor |
| **KB Topic** | KB-10 Section 9 (line 688, 752) |

KB-10 Section 9 specifies that `buildConfigOptions` should default to `'vibecoding'` mode:
```typescript
// KB-10 line 688:
export function buildConfigOptions(
  currentMode: GoodVibesMode = 'vibecoding',
```
And line 752: `configOptions: buildConfigOptions(), // starts in vibecoding by default`

But the implementation defaults to `'justvibes'` (line 39). While `'justvibes'` may be a deliberate safety choice, it diverges from the guide without documented rationale.

**Fix:** Either change the default to `'vibecoding'` per KB-10, or add a comment documenting why `'justvibes'` was chosen as the safer default.

---

### Issue 4 — Missing `emitConfigUpdate` function from KB-10

| Field | Value |
|-------|-------|
| **File** | `src/extensions/acp/config-adapter.ts` |
| **Line** | 133 (end of file) |
| **Severity** | Minor |
| **KB Topic** | KB-10 Section 9 (lines 732-745) |

KB-10 Section 9 describes an `emitConfigUpdate` function for agent-initiated config updates (e.g., mode auto-switched after planning):
```typescript
export async function emitConfigUpdate(
  conn: acp.AgentSideConnection,
  sessionId: string,
  options: acp.ConfigOption[],
): Promise<void> { ... }
```

This function is not present in `config-adapter.ts`. While it may be implemented elsewhere (e.g., `session-adapter.ts`), its absence from the canonical config-adapter file means agent-initiated config pushes have no reusable helper.

**Fix:** Add `emitConfigUpdate` to `config-adapter.ts` or document where this capability is implemented.

---

### Issue 5 — `GoodVibesMode` includes `'plan'` which is not in KB-10

| Field | Value |
|-------|-------|
| **File** | `src/extensions/acp/config-adapter.ts` |
| **Line** | 16 |
| **Severity** | Nitpick |
| **KB Topic** | KB-10 Section 9 (line 685) |

KB-10 defines `GoodVibesMode = 'justvibes' | 'vibecoding' | 'sandbox'` (3 modes). The implementation adds a fourth mode `'plan'`. This is not necessarily wrong (the implementation may have evolved beyond the guide), but it's undocumented in the KB.

**Fix:** Update KB-10 to include the `'plan'` mode, or add a comment in the code explaining the addition.

---

### Issue 6 — `Config.validate()` does not validate `logging.level`

| Field | Value |
|-------|-------|
| **File** | `src/core/config.ts` |
| **Line** | 296-314 |
| **Severity** | Minor |
| **KB Topic** | L0 `LogLevel` type (`src/types/config.ts:13`) |

`validate()` checks `runtime.mode`, `runtime.port`, `wrfc.minReviewScore`, and `wrfc.maxFixAttempts`, but does not validate `logging.level` against the `LogLevel` union (`'debug' | 'info' | 'warn' | 'error' | 'silent'`). Since env var overrides can set arbitrary string values for `logging.level`, this value could silently become invalid.

**Fix:** Add validation for `logging.level` against the `LogLevel` enum values.

---

### Issue 7 — `applyEnvOverrides` number coercion is too narrow

| Field | Value |
|-------|-------|
| **File** | `src/core/config.ts` |
| **Line** | 142 |
| **Severity** | Minor |
| **KB Topic** | Config env override system |

The regex `/^\d+$/` only matches positive integers. Floating-point values like `GOODVIBES_WRFC__MIN_REVIEW_SCORE=9.5` will be treated as strings rather than numbers, silently breaking the config value's expected type.

**Fix:** Use a regex like `/^-?\d+(\.\d+)?$/` and `parseFloat` instead of `parseInt` for numeric coercion, or use `Number(envValue)` with `!isNaN` check.

---

### Issue 8 — `_notifyChange` swallows listener errors

| Field | Value |
|-------|-------|
| **File** | `src/core/config.ts` |
| **Line** | 333-338 |
| **Severity** | Minor |
| **KB Topic** | Error handling, observability |

Listener errors are caught and logged to `console.error` but not propagated to any structured logging or error tracking system. In production, a failing config change listener could silently break functionality (e.g., a WRFC threshold change not propagating to the orchestrator) with only a stderr message as evidence.

**Fix:** Either emit an event on the EventBus for listener failures, or log via the structured logging system (`LogsManager`) instead of raw `console.error`.

---

### Issue 9 — L0 `SessionConfigOptionChoice` missing `_meta` field

| Field | Value |
|-------|-------|
| **File** | `src/types/config.ts` |
| **Line** | 76-83 |
| **Severity** | Nitpick |
| **KB Topic** | ACP SDK extensibility (`SessionConfigSelectOption._meta`) |

The SDK's `SessionConfigSelectOption` includes an optional `_meta` field for extensibility metadata. The L0 type omits this, which means any GoodVibes-specific metadata on individual config option values would need to be added ad-hoc rather than through the type system.

**Fix:** Add `_meta?: Record<string, unknown>` to `SessionConfigOptionChoice`.

---

## Category Breakdown

| Category | Score | Key Issues |
|----------|-------|------------|
| Security | 9/10 | No secrets exposure, env var handling is safe |
| Error Handling | 7/10 | Listener errors swallowed, validation gaps |
| Organization | 9/10 | Clean L0/L1/L2 layering, good separation |
| Performance | 9/10 | deepClone via JSON is adequate for config sizes |
| SOLID/DRY | 8/10 | L0 type diverges from SDK type (DRY violation) |
| Naming | 8/10 | `label` vs `name` mismatch with SDK |
| Maintainability | 8/10 | Well-documented, good JSDoc comments |
| Documentation | 7/10 | Incorrect comment on line 88 about spec support |
| Testing | N/A | Tests not in scope |
| Dependencies | 9/10 | Config has zero external deps, adapter uses SDK correctly |

---

## Score: 7.4/10

**2 Major** | **4 Minor** | **2 Nitpick** | **1 Incorrect comment**

The major issues are the L0 type divergence from the SDK schema (`label` vs `name`, unsupported `boolean`/`text` types). These can cause wire-format incompatibilities if any code path uses the L0 types to build ACP responses rather than the SDK types directly.
