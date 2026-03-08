# ISS-113 — `ServiceRegistry.load()` does not validate individual `ServiceEntry` fields

**Severity**: Minor
**File**: `src/extensions/services/registry.ts`
**KB Topic**: KB-10: Validation

## Original Issue
`ServiceRegistry.load()` validates store structure but not individual entries. A corrupted entry with missing `name` or `endpoint` could cause runtime errors.

## Verification

### Source Code Check
At lines 119-134, `load()` validates:
- The parsed JSON is an object (not array, not null) — line 120
- The `services` field is an array if present — line 126
- The `$schema` field is a string if present — line 133

However, individual `ServiceEntry` objects in the array are NOT validated. Lines 131-134 cast `typedCandidate.services` directly to `ServiceEntry[]` without checking that each entry has `name` (string), `config.endpoint` (string), or `registeredAt` (string). A corrupted file could inject entries with missing fields that crash later operations (e.g., `register()` validates endpoints via `new URL()` but `load()` skips this).

### ACP Spec Check
KB-10 provides general implementation guidance including validation best practices. KB-08 mentions forward compatibility — unknown fields should be ignored, but required fields should still be validated. This is a robustness/defensive-coding issue rather than a direct ACP protocol violation.

### Verdict: PARTIAL
The store-level validation exists and was added via ISS-041, but per-entry field validation is genuinely missing. The issue correctly identifies the gap. However, this is a code robustness concern, not a direct ACP protocol compliance violation.

## Remediation
1. Add a `_validateEntry(entry: unknown): entry is ServiceEntry` type guard that checks for `name` (non-empty string), `config.endpoint` (valid URL), and `registeredAt` (string).
2. Filter out invalid entries during `load()` with a warning log, rather than crashing on corrupted data.
3. Consider reusing the `new URL()` validation from `register()` for loaded entries.
