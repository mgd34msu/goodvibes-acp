# ISS-111 — `ServiceAuthOrchestrator` not wired to any ACP extension method

**Severity**: Minor
**File**: `src/extensions/services/auth.ts`
**KB Topic**: KB-08: Extension Methods

## Original Issue
`ServiceAuthOrchestrator` is implemented but not connected to any `_goodvibes/auth` handler. ISS-039 documents this as future work.

## Verification

### Source Code Check
At lines 55-57, the class doc explicitly states:
```
STATUS: Not yet integrated with ACP (ISS-039).
This class is fully implemented but is not wired to any ACP extension method
or runtime path. It is exported for future use.
```
The code even includes integration instructions at lines 59-62 showing how to wire it. The class is fully implemented with `authenticate()`, bearer/basic/api-key strategies, and event bus emissions. It is intentionally deferred, not accidentally missing.

### ACP Spec Check
KB-08 defines `_goodvibes/*` extension methods as custom namespace methods. There is no `_goodvibes/auth` method defined in KB-08's planned methods table (lines 191-198). External service auth orchestration is an internal concern, not an ACP protocol requirement.

### Verdict: NOT_ACP_ISSUE
The class is intentionally unwired and documented as pending integration (ISS-039). ACP does not define a `_goodvibes/auth` extension method. This is an internal feature-completeness item, not a protocol compliance issue.
