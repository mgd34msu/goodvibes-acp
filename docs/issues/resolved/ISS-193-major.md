# ISS-193 — Config Swallows Listener Errors Silently

**Severity**: Major
**File**: src/core/config.ts:347-349
**KB Topic**: Overview

## Original Issue

**[src/core/config.ts:347-349]** Config swallows listener errors silently — empty `catch {}`. *(Overview)*

## Verification

### Source Code Check

Lines 344-350 of `src/core/config.ts`:
```typescript
private _notifyChange(key: string, newValue: unknown, oldValue: unknown): void {
  for (const listener of this._listeners) {
    try {
      listener(key, newValue, oldValue);
    } catch {
      // Swallow errors from config change listeners
    }
  }
}
```

The empty `catch {}` block silently discards any exception thrown by a config change listener. This is confirmed.

### ACP Spec Check

The ACP Overview and Implementation Guide KB files address protocol-level error handling — specifically JSON-RPC error responses (code, message, data fields) and how agents should signal failures to clients. The ACP spec does not govern how internal configuration managers handle listener exceptions. `Config._notifyChange()` is an internal runtime utility, not part of the ACP wire protocol.

The cross-cutting theme "Silent Error Swallowing" (issue #89 etc.) is a code quality pattern that affects observability, but the ACP spec does not mandate specific internal error propagation behavior for configuration subsystems.

### Verdict: NOT_ACP_ISSUE

The issue is real: silently swallowing listener errors masks bugs and makes debugging difficult. At minimum the error should be logged. However, the ACP specification does not govern internal configuration listener error handling. This is a code quality / observability issue, not an ACP compliance issue.

## Remediation

N/A (not an ACP compliance issue)

For observability, emit to the event bus or at minimum log:
```typescript
} catch (err: unknown) {
  // Log but don't re-throw — a bad listener should not break config propagation
  console.error('[Config] listener error for key', key, err);
}
```
