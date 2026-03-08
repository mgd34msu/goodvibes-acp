/**
 * @module review/scoring-engine
 * @layer L3 — plugin
 *
 * Deterministic score calculator for the LLM-powered review system.
 * Takes a list of ReviewIssue objects and computes a score in [0, 10]
 * based on severity counts and configurable penalties with per-severity caps.
 *
 * This module is intentionally free of side effects and safe to call
 * from any context.
 */

import type { IssueSeverity, ReviewIssue, ScoringConfig } from './types.js';
import { DEFAULT_SCORING_CONFIG } from './types.js';

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic score from a list of review issues.
 *
 * Scoring formula:
 * - Start at `config.base` (default 10.0)
 * - Apply critical deductions: max(criticalCap, count * criticalPenalty)
 * - Apply major deductions: max(majorCap, count * majorPenalty)
 * - Apply minor deductions: max(minorCap, count * minorPenalty)
 * - Nitpicks have no score impact
 * - Clamp final score to [0, 10] rounded to 1 decimal place
 *
 * @param issues - List of review issues to score
 * @param config - Scoring configuration (defaults to DEFAULT_SCORING_CONFIG)
 * @returns Score in [0.0, 10.0]
 */
export function calculateScore(
  issues: ReviewIssue[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  let score = config.base;

  const criticals = issues.filter(i => i.severity === 'critical').length;
  const majors = issues.filter(i => i.severity === 'major').length;
  const minors = issues.filter(i => i.severity === 'minor').length;

  score += Math.max(config.criticalCap, criticals * config.criticalPenalty);
  score += Math.max(config.majorCap, majors * config.majorPenalty);
  score += Math.max(config.minorCap, minors * config.minorPenalty);

  return Math.max(0, Math.min(10, parseFloat(score.toFixed(1))));
}

// ---------------------------------------------------------------------------
// Score breakdown
// ---------------------------------------------------------------------------

/** Per-severity issue counts */
export type IssueCounts = Record<IssueSeverity, number>;

/** Per-severity score deductions (negative values) */
export type IssueDeductions = Record<IssueSeverity, number>;

/** Detailed breakdown of how a score was computed */
export interface ScoreBreakdown {
  /** Final score in [0, 10] */
  score: number;
  /** Count of issues per severity */
  counts: IssueCounts;
  /** Actual deduction applied per severity (capped) */
  deductions: IssueDeductions;
}

/**
 * Compute a score and return a full breakdown of counts and deductions
 * for transparency and debugging.
 *
 * @param issues - List of review issues to score
 * @param config - Scoring configuration (defaults to DEFAULT_SCORING_CONFIG)
 * @returns Breakdown including final score, per-severity counts, and deductions
 */
export function scoreBreakdown(
  issues: ReviewIssue[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ScoreBreakdown {
  const criticals = issues.filter(i => i.severity === 'critical').length;
  const majors = issues.filter(i => i.severity === 'major').length;
  const minors = issues.filter(i => i.severity === 'minor').length;
  const nitpicks = issues.filter(i => i.severity === 'nitpick').length;

  const criticalDeduction = Math.max(config.criticalCap, criticals * config.criticalPenalty);
  const majorDeduction = Math.max(config.majorCap, majors * config.majorPenalty);
  const minorDeduction = Math.max(config.minorCap, minors * config.minorPenalty);

  const score = Math.max(
    0,
    Math.min(10, parseFloat((config.base + criticalDeduction + majorDeduction + minorDeduction).toFixed(1))),
  );

  return {
    score,
    counts: {
      critical: criticals,
      major: majors,
      minor: minors,
      nitpick: nitpicks,
    },
    deductions: {
      critical: criticalDeduction,
      major: majorDeduction,
      minor: minorDeduction,
      nitpick: 0,
    },
  };
}
