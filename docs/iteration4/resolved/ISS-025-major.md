# ISS-025 — Config file never loaded at startup

**Severity**: Major
**File**: `src/main.ts`
**Lines**: 72
**KB Reference**: KB-10 (Implementation)

## Description

`Config` is instantiated at line 72 (`const config = new Config()`) but `config.load()` is never called anywhere in the startup sequence. Any `goodvibes.config.json` file in the project directory is silently ignored. All config values remain at their defaults regardless of user configuration.

Grepping for `config.load` across the entire codebase returns zero matches in `main.ts`.

### Verdict: CONFIRMED

The `Config` object is created but never loaded. Users have no way to customize runtime behavior via configuration files.

## Remediation

1. Call `await config.load()` early in the startup sequence (after instantiation, before any `config.get()` calls)
2. Place the call before L2 extensions are constructed so they receive loaded values
3. Log a warning if the config file is not found (informational, not an error)
4. Consider supporting config file path override via `--config` CLI arg or `GOODVIBES_CONFIG` env var
