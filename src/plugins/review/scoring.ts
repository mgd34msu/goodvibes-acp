/**
 * @module scoring
 * @layer L3 — plugin
 *
 * 10-dimension scoring rubric for code reviews.
 * Provides dimension definitions, weighted score computation, and issue types.
 */

// ---------------------------------------------------------------------------
// Dimension definitions
// ---------------------------------------------------------------------------

/** A single review dimension with its weight and description */
export type ReviewDimensionConfig = {
  /** Dimension name (e.g. "correctness", "type-safety") */
  name: string;
  /** Weight in overall score (0–1). All weights sum to 1.0. */
  weight: number;
  /** Human-readable description of what this dimension measures */
  description: string;
};

/** The 10 standard review dimensions used by CodeReviewer */
export const REVIEW_DIMENSIONS: ReviewDimensionConfig[] = [
  { name: 'correctness',     weight: 0.15, description: 'Does the code work correctly?' },
  { name: 'architecture',    weight: 0.12, description: 'Proper layer boundaries and patterns?' },
  { name: 'error-handling',  weight: 0.12, description: 'Robust error handling, no-throw contracts?' },
  { name: 'type-safety',     weight: 0.10, description: 'Strict types, no any leaks?' },
  { name: 'security',        weight: 0.12, description: 'No secrets, no injection, capability gating?' },
  { name: 'performance',     weight: 0.08, description: 'No N+1, proper async, no unnecessary allocs?' },
  { name: 'maintainability', weight: 0.08, description: 'Clear naming, good organization, DRY?' },
  { name: 'completeness',    weight: 0.10, description: 'All requirements implemented?' },
  { name: 'testing-surface', weight: 0.07, description: 'Public APIs testable via DI?' },
  { name: 'documentation',   weight: 0.06, description: 'JSDoc on public APIs, module headers?' },
];

// ---------------------------------------------------------------------------
// Score computation
// ---------------------------------------------------------------------------

/**
 * Compute a weighted average score from per-dimension scores.
 *
 * @param dimensionScores - Map of dimension name → score (0–10)
 * @returns Weighted overall score (0–10), or 0 if no matching dimensions found
 */
export function computeWeightedScore(dimensionScores: Record<string, number>): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of REVIEW_DIMENSIONS) {
    const score = dimensionScores[dim.name];
    if (score !== undefined) {
      weightedSum += score * dim.weight;
      totalWeight += dim.weight;
    }
  }

  if (totalWeight === 0) return 0;
  // Normalize in case not all dimensions are scored
  return weightedSum / totalWeight;
}

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

/** Severity level of a review issue */
export type IssueSeverity = 'critical' | 'major' | 'minor' | 'nitpick';

/** A single review issue with location and severity */
export type ReviewIssue = {
  /** How severe this issue is */
  severity: IssueSeverity;
  /** Which review dimension this issue belongs to */
  dimension: string;
  /** File path where the issue was found */
  file: string;
  /** Optional line number */
  line?: number;
  /** Human-readable description of the issue */
  description: string;
  /** Optional suggested fix */
  suggestion?: string;
};
