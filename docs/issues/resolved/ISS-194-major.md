# ISS-194 — Registry Uses unknown Type Erasure, No Runtime Type Safety

**Severity**: Major
**File**: src/core/registry.ts:37-39
**KB Topic**: Overview

## Original Issue

**[src/core/registry.ts:37-39]** Registry uses `unknown` type erasure for `_single` and `_multi` maps. No runtime type safety. *(Overview)*

## Verification

### Source Code Check

Lines 37-38 of `src/core/registry.ts`:
```typescript
/** Single-value registry: key → implementation */
private readonly _single = new Map<string, unknown>();
/** Multi-value registry: kind → Map<key, implementation> */
private readonly _multi = new Map<string, Map<string, unknown>>();
```

The maps use `unknown` as the value type. The `get<T>()` and `getAll<T>()` methods return typed values via TypeScript generics, but at runtime any value can be stored and retrieved as any type — there is no `instanceof` check or interface validation when retrieving. This is confirmed.

### ACP Spec Check

The ACP Overview KB describes the high-level architecture of agents and clients. The ACP specification does not define requirements for internal dependency injection containers or service locator patterns. `Registry` is a GoodVibes-internal L1 primitive for wiring together the runtime — it is not an ACP protocol concept.

The ACP spec's type safety requirements apply to wire-format messages (JSON-RPC `params` and `result` fields), not to internal runtime registries.

### Verdict: NOT_ACP_ISSUE

The issue is real: using `unknown` with unchecked type assertions via generics means a wrong type could be stored under a key and retrieved incorrectly, causing runtime errors that are hard to trace. However, this is an internal TypeScript design pattern concern. The ACP specification has no requirements about how agents implement internal dependency injection. This is not an ACP compliance issue.

## Remediation

N/A (not an ACP compliance issue)

For type safety, consider adding runtime interface checks via a brand/tag pattern or storing constructors for validation. Alternatively, document that callers are responsible for correct typing conventions.
