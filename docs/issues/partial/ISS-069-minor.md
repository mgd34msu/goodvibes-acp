# ISS-069 — `PermissionGate` Uses `DOMException` for Cancellation Detection — Node.js Incompatible

**Severity**: Minor
**File**: src/extensions/acp/permission-gate.ts:187-189
**KB Topic**: Cancellation During Permission (05-permissions.md lines 383-390)

## Original Issue
Cancellation detection uses `err instanceof DOMException`, a browser API not reliably available in Node.js. The cancellation check may always be false.

## Verification

### Source Code Check
Lines 186-194 of `src/extensions/acp/permission-gate.ts`:
```typescript
    } catch (err) {
      const isCancelled =
        err instanceof Error &&
        (err.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError'));
      return {
        granted: false,
        reason: isCancelled ? 'cancelled' : 'Permission request failed',
      };
    }
```

The check has two conditions ORed together:
1. `err.name === 'AbortError'` — works in any environment
2. `err instanceof DOMException && err.name === 'AbortError'` — browser-specific

### ACP Spec Check
KB-05 (lines 383-390) states:
> If the client sends a `session/cancel` while `session/request_permission` is in-flight, the pending request should resolve as `granted: false`.

KB-10 mentions catching `AbortError` for cancellation handling.

### Verdict: PARTIAL
The issue is partially correct. `DOMException` is actually available in Node.js 17+ as a global, so the `instanceof DOMException` check would work in modern Node.js. However, the check is redundant: condition 1 (`err.name === 'AbortError'`) already catches all `AbortError` instances regardless of whether they are `DOMException` or plain `Error`. The `DOMException` check in condition 2 is unnecessary — if `err instanceof DOMException && err.name === 'AbortError'` is true, then `err.name === 'AbortError'` was already true from condition 1. The real issue is code redundancy, not Node.js incompatibility.

## Remediation
1. Simplify the cancellation check to just:
```typescript
const isCancelled = err instanceof Error && err.name === 'AbortError';
```
2. This handles both browser (`DOMException`) and Node.js (`AbortError`) cancellation patterns
