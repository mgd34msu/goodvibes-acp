# ISS-047 — L2 Scoring File Imports from L3 Plugins — Layer Dependency Violation

**Severity**: Major
**File**: src/extensions/review/scoring.ts:27-33
**KB Topic**: Layer Architecture (10-implementation-guide.md layer rules)

## Original Issue
The file declares `@layer L2` but imports from `../../plugins/review/scoring.js` which is an L3 plugin.

## Verification

### Source Code Check
At lines 1-33, the file header declares itself as L2:
```typescript
/**
 * @module extensions/review/scoring
 * @layer L2 — extensions review scoring
 *
 * Re-exports the canonical 10-dimension scoring rubric from the plugins layer
 * for use within the extensions layer.
```
And at line 32, it imports from the L3 plugins layer:
```typescript
export {
  REVIEW_DIMENSIONS,
  computeWeightedScore,
  type ReviewDimensionConfig,
  type IssueSeverity,
  type ReviewIssue,
} from '../../plugins/review/scoring.js';
```
The file explicitly acknowledges it is re-exporting from the plugins layer.

### ACP Spec Check
KB-10 (line 7): "**Layer**: L2 Extensions — imports L0 types and L1 core primitives only"

The layer architecture is strict:
- L0: Types (no runtime imports)
- L1: Core primitives
- L2: Extensions (imports L0 + L1 only)
- L3: Plugins (imports L0 + L1 + L2)

L2 importing from L3 creates a circular dependency direction.

### Verdict: CONFIRMED
The file is tagged `@layer L2` but imports from `src/plugins/` (L3). This directly violates the KB-10 layer rule "L2 Extensions — imports L0 types and L1 core primitives only." The dependency arrow points upward (L2 -> L3) instead of downward.

## Remediation
1. Move the canonical scoring types and constants (`REVIEW_DIMENSIONS`, `computeWeightedScore`, etc.) to L0 (`src/types/`) or L1 (`src/core/`).
2. Have both L2 (`src/extensions/review/scoring.ts`) and L3 (`src/plugins/review/scoring.ts`) import from the shared L0/L1 location.
3. Remove the re-export file entirely if L2 consumers can import from L0/L1 directly.
