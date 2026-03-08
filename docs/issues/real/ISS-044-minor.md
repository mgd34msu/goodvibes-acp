# ISS-044 — Plaintext credential storage without restrictive file permissions

**Severity**: Minor
**File**: `src/extensions/services/registry.ts`
**KB Topic**: KB-10: Security

## Original Issue
`save()` writes credentials as plaintext JSON without setting restrictive file permissions (chmod 600). The ISS-042 comment documents the need but does not implement it.

## Verification

### Source Code Check
Line 164 (in the `save()` method):
```typescript
await writeFile(filePath, JSON.stringify(this._store, null, 2), 'utf-8');
```
No `mode` option is passed to `writeFile`. The JSDoc comment above (lines 155-160) documents the security requirements including "Protected with filesystem permissions (chmod 600 or equivalent)" but the implementation does not enforce this.

### ACP Spec Check
KB-10 covers implementation guidance including security best practices. While the spec does not mandate specific file permission modes, storing credentials with default permissions (typically 644 on Unix) exposes them to other users on the system.

### Verdict: CONFIRMED
The code documents the need for restrictive permissions but does not implement them. The `writeFile` call uses the default file mode, leaving credentials world-readable on typical Unix systems.

## Remediation
1. Pass `{ mode: 0o600 }` as the options argument to `writeFile` to restrict read/write to the file owner only
2. Also set restrictive permissions on the parent directory via `mkdir` with `{ recursive: true, mode: 0o700 }`
