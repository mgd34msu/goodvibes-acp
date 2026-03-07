# ISS-155 — Empty Catch Block Silently Swallows File Read Errors

**Severity**: Minor
**File**: `src/plugins/frontend/accessibility.ts:317`
**KB Topic**: Extensibility

## Original Issue
Empty `catch` block silently swallows file read errors.

## Verification

### Source Code Check
Lines 307-320 of `src/plugins/frontend/accessibility.ts`:
```typescript
for (const file of files) {
  try {
    const source = await readFile(resolve(file), 'utf-8');
    for (const rule of ALL_RULES) {
      const issues = rule.check(source);
      allIssues.push(...issues);
    }
  } catch {
    // skip unreadable files
  }
}
```

The `catch` block is empty except for a comment. File read failures are silently swallowed — the caller receives no indication which files were skipped, and unreadable files produce zero accessibility issues without surfacing any warning.

### ACP Spec Check
The ACP spec does not define requirements for how accessibility analysis tools handle file read errors. The KB (`08-extensibility.md`) covers plugin protocol integration, not internal error handling within plugin logic. This is not an ACP wire format issue.

### Verdict: NOT_ACP_ISSUE
The issue is real — silent error swallowing means callers cannot distinguish between "no issues found" and "file was unreadable." However, this is an internal plugin error handling issue, not an ACP protocol compliance violation.

## Remediation
N/A for ACP compliance. As a code quality fix:
```typescript
} catch (err) {
  // Log skipped files so callers can diagnose coverage gaps
  console.warn(`[accessibility] Skipping unreadable file: ${file}`, err);
}
```
Or surface skipped files in the `A11yReport` return type.
