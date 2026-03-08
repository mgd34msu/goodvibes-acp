# Wave 1 Review — Agent 10: Config & Initialization

**Scope**: `src/types/config.ts`, `src/core/config.ts`, `src/main.ts`  
**KB References**: KB-01 (Overview), KB-02 (Initialization), KB-03 (Sessions/ConfigOptions), KB-10 (Implementation Guide)  
**Reviewer**: ACP Compliance Review Agent (Iteration 4)

---

## Issues

### 1. Config file never loaded at startup

| Field | Value |
|-------|-------|
| **File** | `src/main.ts:71` |
| **Severity** | Major |
| **KB Topic** | KB-10 §2 (Project Setup), general config management |

`Config` is instantiated (`new Config()`) but `config.load()` is never called anywhere in `main.ts`. The `Config.load()` method exists and supports JSON file loading with env override re-application, but the startup sequence skips it entirely. Any `goodvibes.config.json` file is silently ignored.

**Fix**: Call `await config.load('./goodvibes.config.json')` (or a configurable path) before reading config values at line 157.

---

### 2. Config validation never invoked

| Field | Value |
|-------|-------|
| **File** | `src/main.ts` (after line 71) |
| **Severity** | Minor |
| **KB Topic** | KB-10 §1 (robustness) |

`Config.validate()` exists with checks for `runtime.mode`, `runtime.port`, `wrfc.minReviewScore`, `wrfc.maxFixAttempts`, and `logging.level`, but is never called during startup. Invalid config values propagate silently.

**Fix**: Call `config.validate()` after loading and check `result.valid`, throwing on failure.

---

### 3. Daemon port/host bypass Config system

| Field | Value |
|-------|-------|
| **File** | `src/main.ts:465–491` |
| **Severity** | Major |
| **KB Topic** | KB-10 §2, config layering |

Daemon mode reads `GOODVIBES_DAEMON_PORT`, `GOODVIBES_DAEMON_HOST`, and `GOODVIBES_DAEMON_HEALTH_PORT` directly from `process.env` and CLI args, completely bypassing the Config system. Meanwhile, `RuntimeConfig` defines `runtime.port` and `runtime.host` fields that go unused. This creates two parallel config paths that can disagree.

**Fix**: Read daemon port/host from `config.get('runtime.port')` and `config.get('runtime.host')`, falling back to CLI args/env only as overrides. Alternatively, unify the env var names so `applyEnvOverrides` handles them (e.g., `GOODVIBES_RUNTIME__PORT` instead of `GOODVIBES_DAEMON_PORT`).

---

### 4. `GOODVIBES_MODE` env var collision with env override system

| Field | Value |
|-------|-------|
| **File** | `src/main.ts:411`, `src/core/config.ts:123` |
| **Severity** | Minor |
| **KB Topic** | Config layering |

`main.ts` checks `process.env.GOODVIBES_MODE === 'daemon'` directly for mode detection. However, `applyEnvOverrides()` would also process `GOODVIBES_MODE` and map it to config path `mode` (a top-level key). This creates ambiguity: the direct check happens before config loading, and the env override system would set a different path than `runtime.mode`.

**Fix**: Use `GOODVIBES_RUNTIME__MODE` for the env var (matching the double-underscore nesting convention), or read mode from `config.get('runtime.mode')` after config is fully loaded.

---

### 5. `SessionConfigOption.category` not typed to ACP standard categories

| Field | Value |
|-------|-------|
| **File** | `src/types/config.ts:109` |
| **Severity** | Minor |
| **KB Topic** | KB-03 line 254: `ConfigOptionCategory` |

KB-03 defines `ConfigOptionCategory = "mode" | "model" | "thought_level" | \`_\${string}\``. The `SessionConfigOption.category` field is typed as plain `string`, which allows non-spec categories without the required `_` prefix for custom ones.

**Fix**: Define `type SessionConfigOptionCategory = 'mode' | 'model' | 'thought_level' | \`_\${string}\`` and use it for the `category` field.

---

### 6. `SessionConfigOption.options` is optional but KB-03 requires it

| Field | Value |
|-------|-------|
| **File** | `src/types/config.ts:120` |
| **Severity** | Major |
| **KB Topic** | KB-03 line 267: `options: ConfigOptionValue[]` |

KB-03 defines `options: ConfigOptionValue[]` as a required field on `ConfigOption`. In `src/types/config.ts`, it is declared as `options?: SessionConfigOptionChoice[]` (optional). Since the only valid `type` is `'select'`, the options array is always needed to define available values.

**Fix**: Change `options?:` to `options:` (remove the `?`).

---

### 7. Missing `_meta` on `SessionConfigOption`

| Field | Value |
|-------|-------|
| **File** | `src/types/config.ts:103–123` |
| **Severity** | Nitpick |
| **KB Topic** | KB-01 line 376, KB-08 extensibility |

KB-01 states all ACP types accept an optional `_meta` field. `SessionConfigOptionChoice` correctly includes `_meta?: Record<string, unknown>`, but `SessionConfigOption` itself does not. This limits extensibility for config options sent over the wire.

**Fix**: Add `_meta?: Record<string, unknown>` to `SessionConfigOption`.

---

### 8. Shutdown grace period ignores `agentGracePeriodMs` config

| Field | Value |
|-------|-------|
| **File** | `src/main.ts:436` |
| **Severity** | Minor |
| **KB Topic** | KB-10 §Bootstrap checklist: graceful teardown |

The graceful shutdown uses `setTimeout(() => process.exit(0), 2000)` — a hardcoded 2-second timer. Meanwhile, `RuntimeConfig.runtime.agentGracePeriodMs` defaults to 10000ms. The config value is never consulted. Agents running long tasks may be killed before their grace period expires.

**Fix**: Use `config.get<number>('runtime.agentGracePeriodMs') ?? 10000` for the timeout value.

---

### 9. Config instance not passed to GoodVibesAgent

| Field | Value |
|-------|-------|
| **File** | `src/main.ts:206` |
| **Severity** | Minor |
| **KB Topic** | KB-03 (configOptions in session/new response), KB-10 §4 |

The `createConnection` factory passes `registry, eventBus, sessionManager, wrfcAdapter, mcpBridge` to `GoodVibesAgent`, but not the `Config` instance. The agent cannot derive session-level `configOptions` defaults (e.g., default model, default mode) from runtime configuration. Config-driven behavior changes require manual plumbing rather than centralized config access.

**Fix**: Pass `config` as a constructor parameter to `GoodVibesAgent`.

---

### 10. `SessionConfigOption.description` placement inconsistency with KB-03

| Field | Value |
|-------|-------|
| **File** | `src/types/config.ts:103–123` |
| **Severity** | Nitpick |
| **KB Topic** | KB-03 line 260–267 |

KB-03 places `description` directly on `ConfigOption` (line 263: `description?: string`) and also on `ConfigOptionValue` (line 273: `description?: string`). The implementation matches this structure, but the `category` field is typed differently: KB-03 specifies `category?: ConfigOptionCategory` (optional), while the implementation has `category: string` (required, untyped). This means the implementation rejects valid ACP config options that omit `category`.

**Fix**: Make `category` optional: `category?: SessionConfigOptionCategory`.

---

## Summary

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | Config file never loaded | Major | `src/main.ts:71` |
| 2 | Config validation never invoked | Minor | `src/main.ts` |
| 3 | Daemon port/host bypass Config | Major | `src/main.ts:465–491` |
| 4 | `GOODVIBES_MODE` env var collision | Minor | `src/main.ts:411` |
| 5 | `category` not typed to ACP categories | Minor | `src/types/config.ts:109` |
| 6 | `options` field incorrectly optional | Major | `src/types/config.ts:120` |
| 7 | Missing `_meta` on `SessionConfigOption` | Nitpick | `src/types/config.ts:103` |
| 8 | Shutdown ignores `agentGracePeriodMs` | Minor | `src/main.ts:436` |
| 9 | Config not passed to agent | Minor | `src/main.ts:206` |
| 10 | `category` required but spec says optional | Nitpick | `src/types/config.ts:109` |

**Severity counts**: 3 Major, 5 Minor, 2 Nitpick

## Overall Score: 5.5 / 10

The Config system has solid internal design (layered overrides, env var parsing, validation, change listeners) but is largely disconnected from the runtime. The config file is never loaded, validation is never called, and daemon mode bypasses the config system entirely. The L0 config types also have several ACP spec mismatches (`options` optionality, `category` typing, missing `_meta`). The initialization flow in `agent.ts` is well-implemented with proper protocol version negotiation, but the config layer that should feed into it is underutilized.
