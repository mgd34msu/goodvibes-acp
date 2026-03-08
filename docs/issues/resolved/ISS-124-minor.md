# ISS-124 — Circular import detection uses O(n) array lookup

**Severity**: Minor
**File**: `src/plugins/project/deps.ts`
**Lines**: 190-195
**KB Topic**: KB-06: Performance

## Original Issue
`files.includes(candidate)` is O(n) per candidate inside nested loops. Converting to `Set<string>` reduces to O(1).

## Verification

### Source Code Check
Confirmed at deps.ts line 192:
```typescript
if (files.includes(candidate)) {
```

This is inside a loop over extensions (line 190: `for (const ext of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.js'])`) which is inside a loop over imports per file, which is inside a `Promise.all` over all files. The `files` array is the full list of project files, making `includes()` an O(n) linear scan repeated many times.

### ACP Spec Check
KB-06 discusses performance considerations for tool implementations. While not a protocol violation, this is a code quality concern that could cause noticeable latency for large projects with many files.

This is a general performance optimization, not specific to ACP protocol compliance.

### Verdict: CONFIRMED
The O(n) `Array.includes()` inside nested loops is confirmed. For projects with thousands of files, this creates O(n*m*k) complexity where a Set would make it O(m*k).

## Remediation
1. Add `const fileSet = new Set(files);` before the `Promise.all` block.
2. Replace `files.includes(candidate)` with `fileSet.has(candidate)` at line 192.
