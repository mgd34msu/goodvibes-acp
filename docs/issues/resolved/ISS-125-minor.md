# ISS-125 — Gitignore pattern matching is overly simplistic — no glob support

**Severity**: Minor
**File**: `src/plugins/project/security.ts`
**Lines**: 197-199
**KB Topic**: KB-08: Forward Compatibility

## Original Issue
Only matches exact line equality. A `.gitignore` containing `.env*` would not match `.env.local`, causing false-positive security warnings.

## Verification

### Source Code Check
Confirmed at security.ts lines 197-199:
```typescript
const isIgnored = gitignoreContent
  .split('\n')
  .some((line) => line.trim() === envFile || line.trim() === `/${envFile}`);
```

This only matches exact string equality (with optional leading `/`). Common gitignore patterns like `.env*`, `.env.*`, or `*.env` use glob wildcards that this code cannot handle. A `.gitignore` with `.env*` would not match `.env.local`, `.env.production`, etc.

### ACP Spec Check
KB-08 discusses forward compatibility and extensibility. This is not directly an ACP protocol issue but affects the `project_security_env` tool's accuracy. False positives (warning about files that ARE properly gitignored via glob patterns) degrade tool usefulness.

### Verdict: CONFIRMED
The gitignore matching uses exact string equality only. Glob patterns, negation patterns, and directory patterns are all unsupported, leading to potential false positives.

## Remediation
1. Use a gitignore-compatible matching library such as `ignore` (npm package) or `minimatch` with gitignore-appropriate options.
2. At minimum, add basic `*` wildcard support: convert gitignore lines containing `*` to regex patterns.
3. Handle common gitignore conventions: leading `/` for root-only, trailing `/` for directories, `!` for negation.
