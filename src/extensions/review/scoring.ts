/**
 * @module extensions/review/scoring
 * @layer L2 — extensions review scoring
 *
 * Re-exports the canonical 10-dimension scoring rubric from the plugins layer
 * for use within the extensions layer.
 *
 * Dimension names (authoritative list, must match review-scoring skill spec):
 *   1.  correctness      (weight 0.15) — Does the code work correctly?
 *   2.  architecture     (weight 0.12) — Proper layer boundaries and patterns?
 *   3.  error-handling   (weight 0.12) — Robust error handling, no-throw contracts?
 *   4.  type-safety      (weight 0.10) — Strict types, no any leaks?
 *   5.  security         (weight 0.12) — No secrets, no injection, capability gating?
 *   6.  performance      (weight 0.08) — No N+1, proper async, no unnecessary allocs?
 *   7.  maintainability  (weight 0.08) — Clear naming, good organization, DRY?
 *   8.  completeness     (weight 0.10) — All requirements implemented?
 *   9.  testing-surface  (weight 0.07) — Public APIs testable via DI?
 *   10. documentation    (weight 0.06) — JSDoc on public APIs, module headers?
 *
 * All weights sum to 1.0. These names are used as keys in ReviewScore.dimensions
 * and must match exactly what CodeReviewer and WRFCOrchestrator expect.
 *
 * @see src/plugins/review/scoring.ts — canonical source
 * @see src/types/wrfc.ts — ReviewScore / ReviewDimension types
 */

export {
  REVIEW_DIMENSIONS,
  computeWeightedScore,
  type ReviewDimensionConfig,
  type IssueSeverity,
  type ReviewIssue,
} from '../../plugins/review/scoring.js';
