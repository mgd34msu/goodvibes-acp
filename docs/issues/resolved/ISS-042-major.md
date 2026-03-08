# ISS-042 — Service Registry Persists Credentials in Plaintext JSON

**Severity**: Major
**File**: src/extensions/services/registry.ts:137
**KB Topic**: Implementation Notes (08-extensibility.md; 10-implementation-guide.md section 12)

## Original Issue
`save()` writes the entire service store including `ServiceAuth` fields (`token`, `password`, `key`) as unencrypted plaintext JSON.

## Verification

### Source Code Check
At line 137, the `save()` method serializes the entire store:
```typescript
async save(): Promise<void> {
  await mkdir(this._basePath, { recursive: true });
  const filePath = join(this._basePath, SERVICES_FILE);
  await writeFile(filePath, JSON.stringify(this._store, null, 2), 'utf-8');
  this._bus.emit('service:saved', { basePath: this._basePath });
}
```
`this._store` includes `ServiceAuth` objects containing `token`, `password`, and `key` fields. These are written as human-readable plaintext JSON.

### ACP Spec Check
The ACP spec itself does not prescribe credential storage mechanisms. However, KB-10 emphasizes handling security edge cases gracefully. Storing bearer tokens, passwords, and API keys in plaintext on disk is a well-established security anti-pattern that exposes credentials to:
- File system access by other processes/users
- Accidental version control commits
- Log file exposure
- Backup/snapshot leakage

### Verdict: CONFIRMED
The code stores sensitive authentication credentials (bearer tokens, passwords, API keys) as plaintext JSON on disk. While the ACP spec does not directly mandate encryption of persisted credentials, this is a clear security vulnerability that the KB-10 error/edge-case handling principles encompass.

## Remediation
1. Encrypt sensitive fields before persisting (e.g., using OS keychain, encrypted-at-rest, or a secrets manager).
2. At minimum, redact auth fields from the serialized JSON and store them separately in a protected location.
3. Add `.gitignore` rules for the services file to prevent accidental commits.
4. Consider using the OS credential store (e.g., `keytar`, macOS Keychain, Windows Credential Manager).
