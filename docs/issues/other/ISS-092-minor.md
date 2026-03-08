# ISS-092 — `Config.validate()` does not validate `logging.level`

**Severity**: Minor  
**File**: `src/core/config.ts`  
**Lines**: 296-314  
**KB Reference**: None (internal quality concern)

## Description

The `validate()` method checks `runtime.mode`, `runtime.port`, `wrfc.minReviewScore`, and `wrfc.maxFixAttempts` but does not validate `logging.level` against the `LogLevel` union type (`'debug' | 'info' | 'warn' | 'error' | 'silent'`). Environment variable overrides could set arbitrary string values.

### Verdict: NOT_ACP_ISSUE

This is an internal config validation gap. The ACP spec and knowledgebase do not define config validation rules for the agent's internal configuration. The `LogLevel` type is a GoodVibes internal type, not an ACP type. The issue references "KB-00" which does not exist.

## Remediation

Still a valid code quality improvement:

1. Add logging.level validation to the `validate()` method:
   ```typescript
   const logLevel = this.get<string>('logging.level');
   const validLevels = ['debug', 'info', 'warn', 'error', 'silent'];
   if (logLevel !== undefined && !validLevels.includes(logLevel)) {
     errors.push(`logging.level must be one of ${validLevels.join(', ')}, got '${logLevel}'`);
   }
   ```
