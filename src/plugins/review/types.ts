/**
 * @module review/types
 * @layer L3 — plugin
 *
 * Types for the LLM-powered review system: structured review issues,
 * submit_review tool input, and scoring configuration.
 *
 * Note: IssueSeverity is shared with L0 review-scoring. ReviewIssue here
 * extends the L0 concept with `title` and `references` fields needed by
 * the LLM reviewer + fixer workflow.
 */

import type { IssueSeverity } from '../../types/review-scoring.js';

export type { IssueSeverity };

// ---------------------------------------------------------------------------
// Review issue types
// ---------------------------------------------------------------------------

/** A reference to a related file that provides context for a fix */
export interface ReviewReference {
  /** File path that was read during the review session */
  file: string;
  /** Line number (optional) */
  line?: number;
  /** Why this reference is relevant */
  note: string;
}

/**
 * A single review issue produced by the LLM reviewer.
 * Differs from the L0 ReviewIssue by using `title` (an issue identifier
 * for the fixer) instead of `dimension`, and adding `references`.
 */
export interface ReviewIssue {
  /** How severe this issue is */
  severity: IssueSeverity;
  /** File path where the issue was found */
  file: string;
  /** Line number (optional) */
  line?: number;
  /** Short identifier used by the fixer to track this issue */
  title: string;
  /** Actionable description: what is wrong, why it matters, how to fix it */
  description: string;
  /** Optional references to related files read during the review */
  references?: ReviewReference[];
}

// ---------------------------------------------------------------------------
// submit_review tool input
// ---------------------------------------------------------------------------

/** Input shape for the submit_review tool call */
export interface SubmitReviewInput {
  /** All issues found during the review */
  issues: ReviewIssue[];
  /** Brief summary of the review findings (1-3 sentences) */
  summary: string;
}

// ---------------------------------------------------------------------------
// Scoring configuration
// ---------------------------------------------------------------------------

/** Configuration for the deterministic scoring engine */
export interface ScoringConfig {
  /** Starting score before deductions (default: 10.0) */
  base: number;
  /** Score deduction per critical issue (default: -3.0) */
  criticalPenalty: number;
  /** Maximum total deduction from critical issues (default: -8.0) */
  criticalCap: number;
  /** Score deduction per major issue (default: -1.0) */
  majorPenalty: number;
  /** Maximum total deduction from major issues (default: -4.0) */
  majorCap: number;
  /** Score deduction per minor issue (default: -0.2) */
  minorPenalty: number;
  /** Maximum total deduction from minor issues (default: -2.0) */
  minorCap: number;
  /** Score deduction per nitpick (default: 0.0 — informational only) */
  nitpickPenalty: number;
}

/** Default scoring configuration used by calculateScore */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  base: 10.0,
  criticalPenalty: -3.0,
  criticalCap: -8.0,
  majorPenalty: -1.0,
  majorCap: -4.0,
  minorPenalty: -0.2,
  minorCap: -2.0,
  nitpickPenalty: 0.0,
};
