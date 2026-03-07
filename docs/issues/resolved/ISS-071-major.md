# ISS-071: Review completion tool_call_update missing _goodvibes/ namespace in _meta

**Severity**: Major
**File**: src/main.ts
**Line(s)**: 294-298
**Topic**: Implementation Guide

## Issue Description
Review completion `tool_call_update` passes `{ score: result.score }` without `_goodvibes/` namespace. Should use `{ '_goodvibes/score': result.score, '_goodvibes/minimumScore': wrfcConfig.minReviewScore, '_goodvibes/dimensions': result.dimensions }`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/10-implementation-guide.md, Section 6 (WRFC as Tool Calls)
- **Spec Says**: Review phase tool_call_update `_meta` must include `'_goodvibes/phase': 'review'`, `'_goodvibes/score'`, `'_goodvibes/minimumScore'`, and `'_goodvibes/dimensions'` keys. All GoodVibes-specific metadata must be namespaced under `_goodvibes/`.
- **Confirmed**: Yes
- **Notes**: The KB implementation guide explicitly shows the namespaced keys in the review completion update (lines 455-461).

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: At line 297, `emitToolCallUpdate` is called with `{ score: result.score }` as the metadata object. No `_goodvibes/` prefix on the `score` key, and `minimumScore` and `dimensions` are entirely missing.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Change line 297 from `{ score: result.score }` to `{ '_goodvibes/score': result.score, '_goodvibes/minimumScore': wrfcConfig.minReviewScore, '_goodvibes/dimensions': result.dimensions }`
2. Ensure `wrfcConfig` and `result.dimensions` are accessible in the callback scope
3. Also add `'_goodvibes/phase': 'review'` to maintain consistency with the spec pattern
