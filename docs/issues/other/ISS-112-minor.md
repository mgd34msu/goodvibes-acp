# ISS-112 — `ServiceHealthChecker` not wired to any ACP extension method

**Severity**: Minor
**File**: `src/extensions/services/health.ts`
**KB Topic**: KB-08: Extension Methods

## Original Issue
`ServiceHealthChecker` is implemented but disconnected from the ACP layer. ISS-040 documents this.

## Verification

### Source Code Check
At lines 58-60, the class doc states:
```
STATUS: Not yet integrated with ACP (ISS-040).
This class is fully implemented but is not wired to any ACP extension method
or runtime path. It is exported for future use.
```
Integration instructions are provided at lines 62-66. The class is fully functional with `check()`, `checkAll()`, retry support, and event emissions.

### ACP Spec Check
KB-08's planned extension methods table (lines 191-198) does not include a `_goodvibes/health` method. Service health checking for external services is an internal operational concern, not a protocol-level requirement.

### Verdict: NOT_ACP_ISSUE
Same pattern as ISS-111. The class is intentionally unwired and documented as pending (ISS-040). ACP does not mandate a health-check extension method.
