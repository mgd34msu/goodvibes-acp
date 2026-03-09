# ISS-061: Config validation never invoked at startup

**Severity**: Minor  
**File**: `src/main.ts`  
**Lines**: After line 71  
**KB Reference**: KB-10 (Implementation Guide)  
**Issue Source**: docs/issues-combined.md #61

## Description

`Config.validate()` exists in `src/core/config.ts` (line 296) with comprehensive validation for `runtime.mode`, `runtime.port`, `wrfc.minReviewScore`, `wrfc.maxFixAttempts`, and `logging.level`. However, it is never called anywhere in `src/main.ts` after the Config is constructed on line 71. Invalid configuration values propagate silently through the runtime.

### Verdict: CONFIRMED

The `Config` class is instantiated on line 71 (`const config = new Config()`) and env overrides are applied in the constructor, but `config.validate()` is never called. No other code path invokes validation either. The validate() method exists but is dead code at startup.

## Remediation

1. Call `config.validate()` after construction and env override application in `src/main.ts` (after line 71)
2. If validation fails, either throw with descriptive error or log warnings via stderr and continue with defaults
3. If a config file is loaded later, re-validate after load

```typescript
const config = new Config();
const validation = config.validate();
if (!validation.valid) {
  console.error('[goodvibes-acp] Config validation errors:', validation.errors);
  // Optionally: throw new Error('Invalid configuration');
}
```
