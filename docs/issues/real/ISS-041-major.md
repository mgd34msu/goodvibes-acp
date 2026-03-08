# ISS-041 — Service Registry Loads JSON Without Validation — Unsafe Cast

**Severity**: Major
**File**: src/extensions/services/registry.ts:113
**KB Topic**: Error Handling (10-implementation-guide.md section 12)

## Original Issue
`JSON.parse` result is cast as `ServiceStore` with no runtime validation. Corrupted or schema-mismatched `services.json` will produce runtime errors far from the source.

## Verification

### Source Code Check
At line 113, the `load()` method reads and parses JSON with an unsafe type assertion:
```typescript
const raw = await readFile(filePath, 'utf-8');
const parsed = JSON.parse(raw) as ServiceStore;
this._store = {
  $schema: parsed.$schema ?? SCHEMA_VERSION,
  services: parsed.services ?? [],
};
```
The `as ServiceStore` cast provides zero runtime guarantees. If the file contains malformed data (e.g., `services` is a string instead of an array), the error will surface later in unrelated code paths.

### ACP Spec Check
KB-10 (section 12) defines error handling patterns including `INVALID_PARAMS` (-32602) for validation errors:
```typescript
if (err instanceof ValidationError) {
  return { code: ACP_ERROR_CODES.INVALID_PARAMS, message: err.message, data: err.details };
}
```
The pattern implies all external data should be validated before use, with meaningful error messages on failure.

### Verdict: CONFIRMED
The code performs an unsafe type assertion on untrusted disk data. There is no schema validation, no structural check, and no meaningful error if the file is corrupted. This directly violates the KB-10 principle of graceful error handling with meaningful messages.

## Remediation
1. Add a runtime schema validator (e.g., Zod, AJV, or a manual structural check) for the `ServiceStore` shape.
2. On validation failure, throw a descriptive error or reset to an empty store with a warning log.
3. Map validation failures to `INVALID_PARAMS` (-32602) if surfaced through ACP.
