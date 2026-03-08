# ISS-038 — Registry.get<T>() casts unknown to T without runtime validation

**Severity**: Minor
**File**: `src/core/registry.ts`
**KB Topic**: KB-01: Type Safety

## Original Issue
`get<T>()` casts `unknown` to `T` with `as T` without any runtime type validation. If a consumer calls `registry.get<IToolProvider>('precision')` but a different type was registered, the bug manifests as a runtime type error far from the source.

## Verification

### Source Code Check
Lines 97-103 of `registry.ts`:
```typescript
get<T>(key: string): T {
  if (!this._single.has(key)) {
    throw new Error(
      `Registry: key '${key}' is not registered. Available: [${Array.from(this._single.keys()).join(', ')}]`
    );
  }
  return this._single.get(key) as T;
}
```
The method checks that the key exists but performs no runtime type validation. The `as T` cast trusts the caller's generic parameter completely. The same pattern appears in `getOptional<T>` (line 113): `return this._single.get(key) as T | undefined`.

### ACP Spec Check
This is an internal implementation pattern, not directly governed by the ACP protocol specification. KB-01 discusses type safety in the context of the protocol's type system, not internal service registries. However, type-safety in the registry affects the reliability of ACP protocol handling code.

### Verdict: CONFIRMED
The unsafe cast is present and could cause runtime errors that are difficult to trace. This is a valid code quality issue, though not strictly an ACP protocol compliance concern.

## Remediation
1. Consider adding an optional type-tag mechanism: `register<T>(key: string, impl: T, typeTag?: string)` and `get<T>(key: string, expectedTag?: string): T` with a runtime check when the tag is provided.
2. Alternatively, add a `validateAll()` method that runs at startup to verify all expected keys are present and have the expected shape.
3. For immediate mitigation, add descriptive error messages that include the key and the expected type when mismatches occur at consumption sites.
