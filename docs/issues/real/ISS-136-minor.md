# ISS-136: `CodeReviewer._detectPattern` false positives on common substrings

**Source**: `src/plugins/review/reviewer.ts` lines 82-99
**KB Reference**: KB-10 (Review Accuracy)
**Severity**: Minor

### Verdict: CONFIRMED

The `_detectPattern` method uses `text.includes()` for substring matching against patterns like `'secret'`, `'password'`, `'token exposed'`, and `'xss'`. This produces false positives:

- `'secret'` matches comments like "this is not a secret" or variable names like `secretaryName`
- `'password'` matches documentation strings like "password requirements" or field labels
- `'expect('` matches test assertion output, not actual errors

These false positives can artificially deflate review scores, particularly the security dimension, causing unnecessary review loop iterations.

### Remediation

1. Use regex with `\b` word boundaries for pattern matching (e.g., `/\bsecret\b/` instead of `'secret'`)
2. Add context-aware matching that considers surrounding tokens (e.g., `'secret'` near `'key'` or `'token'` is more likely a real issue)
3. Consider a confidence threshold or whitelist for known safe patterns
