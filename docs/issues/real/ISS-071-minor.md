# ISS-071 — `console.error` used for warning-level message
**Severity**: Minor
**File**: `src/extensions/hooks/built-ins.ts`
**KB Topic**: KB-08: Logging / Extensibility

## Original Issue
Missing permission context is a warning, not an error. Using `console.error` inflates error-level noise. Should use `console.warn` instead.

## Verification

### Source Code Check
Line 50 of `built-ins.ts`:
```typescript
console.error('[Hooks] Warning: Agent spawned without permission context');
```
The message text itself says "Warning" but uses `console.error`, which is error-level severity.

### ACP Spec Check
KB-08 uses `console.warn` for advisory/non-critical messages (e.g., line 341: `console.warn('Unknown extension method: ...')`). Error-level logging should be reserved for actual errors, not warnings.

### Verdict: CONFIRMED
The message is advisory ("spawned without permission context") and not an error condition. Using `console.error` inflates error-level noise in production logs. The message text itself labels it as a "Warning."

## Remediation
1. Change `console.error` to `console.warn` on line 50 of `src/extensions/hooks/built-ins.ts`.
