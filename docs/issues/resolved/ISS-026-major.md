# ISS-026 — Daemon port/host bypass Config system

**Severity**: Major
**File**: `src/main.ts`
**Lines**: 465-491
**KB Reference**: KB-10 (Config)

## Description

Daemon mode reads port, host, health port, and PID file path directly from `process.env` and CLI args (`process.argv`), completely bypassing the `Config` system:

```typescript
const daemonPort = parseInt(
  process.env.GOODVIBES_DAEMON_PORT ?? getArgValue('--port') ?? '9000', 10
);
const daemonHost =
  process.env.GOODVIBES_DAEMON_HOST ?? getArgValue('--host') ?? '127.0.0.1';
```

This creates two parallel configuration paths that can disagree. A user setting `runtime.port` in `goodvibes.config.json` would have no effect on daemon mode.

### Verdict: CONFIRMED

Lines 470-491 read exclusively from `process.env` and CLI args. The `Config` instance exists but is never consulted for daemon settings. Combined with ISS-025 (config never loaded), this creates a completely non-functional config system for daemon mode.

## Remediation

1. Define daemon config keys in the Config schema (e.g., `runtime.port`, `runtime.host`, `runtime.healthPort`)
2. Read from `config.get('runtime.port')` with env vars and CLI args as override layers
3. Precedence should be: CLI args > env vars > config file > defaults
4. This depends on ISS-025 being resolved first (config.load() must be called)
