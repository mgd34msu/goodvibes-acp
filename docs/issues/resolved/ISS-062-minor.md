# ISS-062: GOODVIBES_MODE env var collision with env override system

**Severity**: Minor  
**File**: `src/main.ts`, `src/core/config.ts`  
**Lines**: 411, 123  
**KB Reference**: KB-10 (Config)  
**Issue Source**: docs/issues-combined.md #62

## Description

Line 411 of `src/main.ts` reads `process.env.GOODVIBES_MODE` directly to determine daemon vs subprocess mode. Meanwhile, the env override system in `src/core/config.ts` (line 123) uses the `GOODVIBES_` prefix with `__` as nesting separator. The env var `GOODVIBES_MODE` would map to a top-level `mode` key (not `runtime.mode`), creating ambiguity.

The direct `process.env.GOODVIBES_MODE` check on line 411 happens before config loading (line 417), so config-based mode detection is bypassed entirely.

### Verdict: CONFIRMED

Line 411: `const mode = process.argv.includes('--daemon') || process.env.GOODVIBES_MODE === 'daemon'`

This reads the env var directly, bypassing the config system. The correct env var per the override convention would be `GOODVIBES_RUNTIME__MODE`. The direct check creates two competing mechanisms for the same setting.

## Remediation

1. Rename the env var to `GOODVIBES_RUNTIME__MODE` to align with the config override system, OR
2. Read mode from `config.get<string>('runtime.mode')` after config is constructed (which already applies env overrides in the constructor)
3. Keep CLI `--daemon` as highest-priority override

```typescript
const mode = process.argv.includes('--daemon')
  ? 'daemon' as const
  : (config.get<string>('runtime.mode') === 'daemon' ? 'daemon' as const : 'subprocess' as const);
```
