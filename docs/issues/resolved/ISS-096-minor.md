# ISS-096 — `_notifyChange` swallows listener errors silently in StateStore

**Severity**: Minor  
**File**: `src/core/state-store.ts`  
**Lines**: 257-265  
**KB Reference**: None (internal quality concern)

## Description

The `_notifyChange` method has an empty `catch {}` block, meaning a failing `onChange` listener produces no diagnostic output. The comment says "Swallow errors from change listeners to protect store integrity."

### Verdict: NOT_ACP_ISSUE

This is an internal state store implementation detail. The ACP spec does not define requirements for internal store listener error handling. The empty catch is intentional to protect store integrity. The issue references "KB-08: Observability" but KB-08 does not specify requirements for internal store error reporting.

## Remediation

Optional improvement:

1. Add `console.error` logging to match the pattern used in `state-machine.ts` and `config.ts`:
   ```typescript
   catch (err: unknown) {
     console.error('[StateStore] listener error:', err);
   }
   ```
