/**
 * @module scoring
 * @layer L3 — plugin
 *
 * Re-exports the canonical 10-dimension scoring rubric from the L0 types layer.
 * Keeping this file as a thin re-export allows existing L3 imports to continue
 * working without changes.
 *
 * @see src/types/review-scoring.ts — canonical L0 source
 */

export {
  REVIEW_DIMENSIONS,
  computeWeightedScore,
  type ReviewDimensionConfig,
  type IssueSeverity,
  type ReviewIssue,
} from '../../types/review-scoring.js';
