# ISS-154 — Dead Method `_formatEntry()` Always Returns Empty String

**Severity**: Minor
**File**: `src/plugins/analytics/export.ts:136-140`
**KB Topic**: Extensibility

## Original Issue
Dead method `_formatEntry()` — always returns `''`, suppressed with eslint-disable.

## Verification

### Source Code Check
Lines 136-140 of `src/plugins/analytics/export.ts`:
```typescript
private _formatEntry(_entry: TokenUsageEntry): string {
  // Utility kept for potential future single-entry formatting
  return '';
}
```

The method:
- Accepts a `TokenUsageEntry` argument prefixed with `_` (indicating intentionally unused)
- Has a comment claiming it is "kept for potential future use"
- Always returns an empty string `''`
- Is suppressed with an eslint-disable comment (per the issue report)

The method is never called anywhere in the file.

### ACP Spec Check
The ACP spec (`08-extensibility.md` KB) concerns protocol-level plugin registration and extension points, not internal analytics export helper methods. There is no ACP requirement relating to dead code in analytics plugins.

### Verdict: NOT_ACP_ISSUE
The issue is confirmed — `_formatEntry()` is dead code with no callers and an always-empty return value. However, this is a code quality / dead code issue, not an ACP protocol compliance violation. The ACP extensibility spec defines how plugins register with the protocol runtime, not how their internal utility methods are maintained.

## Remediation
N/A for ACP compliance. As a code quality fix, remove the dead method:
```typescript
// Delete lines 136-140 entirely
```
