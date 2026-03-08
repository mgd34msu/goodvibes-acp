/**
 * @module extensions/review/scoring
 * @layer L2 — extensions review scoring
 *
 * Re-exports the canonical 10-dimension scoring rubric from the L0 types layer.
 * Both L2 (extensions) and L3 (plugins) import from the shared L0 location to
 * avoid upward layer dependencies (L2 must not import from L3).
 *
 * @see src/types/review-scoring.ts — canonical L0 source
 * @see src/types/wrfc.ts — ReviewScore / ReviewDimension types
 */

export {
  REVIEW_DIMENSIONS,
  computeWeightedScore,
  type ReviewDimensionConfig,
  type IssueSeverity,
  type ReviewIssue,
} from '../../types/review-scoring.js';
