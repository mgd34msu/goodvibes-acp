# ISS-144 — deepMerge Duplicated Between config.ts and state-store.ts

**Severity**: Minor
**File**: src/core/state-store.ts
**KB Topic**: Overview

## Original Issue
Duplicated `deepMerge` implementation between `config.ts` and `state-store.ts`. Extract to shared utility.

## Verification

### Source Code Check
`src/core/config.ts` (lines ~68–80):
```typescript
function deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key as keyof T];
    if (srcVal !== null && typeof srcVal === 'object' && !Array.isArray(srcVal)
        && tgtVal !== null && typeof tgtVal === 'object' && !Array.isArray(tgtVal)) {
      // recursive merge
    } ...
  }
}
```

`src/core/state-store.ts` (lines 47–72):
```typescript
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) { ... }
}
```

Both implementations are local `function` declarations with identical logic but slightly different type signatures (`source: Record<string, unknown>` vs `source: Partial<T>`). The duplication is confirmed.

### ACP Spec Check
The ACP spec does not address internal utility function organization. This is a code maintainability concern with no bearing on ACP protocol compliance.

### Verdict: NOT_ACP_ISSUE
The duplication is confirmed. Two implementations of the same algorithm exist in two L1 core files, with a minor type signature difference. This increases maintenance burden — a bug fix in one would not propagate to the other. However, this is not an ACP compliance issue.

## Remediation
1. Create `src/core/utils.ts` with a single exported `deepMerge` function using the stricter `Partial<T>` signature.
2. Replace the local `deepMerge` in both `config.ts` and `state-store.ts` with imports from `src/core/utils.ts`.
3. Verify that `config.ts` L1 layer constraints allow imports from `src/core/utils.ts` (same layer — acceptable).
