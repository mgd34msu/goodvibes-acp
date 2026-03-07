/**
 * @module reviewer
 * @layer L3 — plugin
 *
 * Programmatic code reviewer implementing IReviewer.
 * Analyzes work results heuristically and produces a scored ReviewResult.
 * Does NOT call external APIs — AI-powered review is a future enhancement.
 *
 * MUST NOT throw — returns score 0 with error details on failure.
 */

import type { IReviewer, WorkResult, ReviewResult } from '../../types/registry.js';
import { REVIEW_DIMENSIONS, computeWeightedScore } from './scoring.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type CodeReviewerOptions = {
  /** Minimum score to pass (0–10). Default: 9.5 */
  minScore?: number;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Heuristic code reviewer.
 *
 * Scores 10 dimensions based on observable signals in the WorkResult:
 * - Presence of errors lowers correctness, error-handling, and completeness
 * - Empty filesModified lowers completeness and correctness
 * - Output patterns (error counts, lint warnings) influence relevant dimensions
 */
export class CodeReviewer implements IReviewer {
  readonly id = 'code-review';
  readonly capabilities = ['typescript', 'general'];

  private readonly minScore: number;

  constructor(options?: CodeReviewerOptions) {
    this.minScore = options?.minScore ?? 9.5;
  }

  /**
   * Review the work result and return a scored ReviewResult.
   * Never throws — returns score 0 with error details on unexpected failure.
   */
  async review(workResult: WorkResult): Promise<ReviewResult> {
    try {
      return this._doReview(workResult);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const zeroDimensions: ReviewResult['dimensions'] = {};
      for (const dim of REVIEW_DIMENSIONS) {
        zeroDimensions[dim.name] = { score: 0, weight: dim.weight, issues: [`Review failed: ${message}`] };
      }
      return {
        sessionId: workResult.sessionId,
        score: 0,
        dimensions: zeroDimensions,
        passed: false,
        issues: [`Review threw unexpectedly: ${message}`],
        notes: 'Internal reviewer error — see issues for details.',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Internal scoring logic
  // ---------------------------------------------------------------------------

  private _doReview(workResult: WorkResult): ReviewResult {
    const { errors, filesModified, output } = workResult;

    const hasErrors = errors.length > 0;
    const hasFiles = filesModified.length > 0;
    const outputLower = output.toLowerCase();

    // Signal detection
    const hasTypeErrors = this._detectPattern(outputLower, [
      'error ts', 'type error', 'typescript error', 'typeerror',
    ]);
    const hasLintErrors = this._detectPattern(outputLower, [
      'eslint error', 'lint error', ' error(s)', 'problems (',
    ]);
    const hasTestFailures = this._detectPattern(outputLower, [
      'test failed', 'failing tests', 'assertion failed', 'expect(', 'tests failed',
    ]);
    const hasBuildFailure = this._detectPattern(outputLower, [
      'build failed', 'compilation failed', 'failed to compile',
    ]);
    const hasSecurityWarning = this._detectPattern(outputLower, [
      'secret', 'password', 'token exposed', 'sql injection', 'xss',
    ]);
    const hasPerformanceIssue = this._detectPattern(outputLower, [
      'n+1', 'memory leak', 'infinite loop', 'blocking call',
    ]);

    // Per-dimension scoring (0–10)
    const scores: Record<string, number> = {
      'correctness':     this._score(10, [
        [hasErrors || hasBuildFailure, -6],
        [hasTestFailures, -4],
        [!hasFiles, -3],
      ]),
      'architecture':    this._score(10, [
        [hasErrors, -2],
        [hasBuildFailure, -4],
      ]),
      'error-handling':  this._score(10, [
        [hasErrors, -4],
        [hasBuildFailure, -3],
      ]),
      'type-safety':     this._score(10, [
        [hasTypeErrors, -6],
        [hasBuildFailure, -4],
        [hasErrors, -2],
      ]),
      'security':        this._score(10, [
        [hasSecurityWarning, -8],
        [hasErrors, -1],
      ]),
      'performance':     this._score(10, [
        [hasPerformanceIssue, -6],
        [hasErrors, -1],
      ]),
      'maintainability': this._score(10, [
        [hasLintErrors, -4],
        [hasErrors, -2],
      ]),
      'completeness':    this._score(10, [
        [!hasFiles, -6],
        [hasErrors, -3],
        [hasBuildFailure, -4],
      ]),
      'testing-surface': this._score(10, [
        [hasTestFailures, -5],
        [hasErrors, -2],
      ]),
      'documentation':   this._score(10, [
        [hasErrors, -1],
      ]),
    };

    // Build dimension breakdown
    const dimensions: ReviewResult['dimensions'] = {};
    const issues: string[] = [];

    for (const dim of REVIEW_DIMENSIONS) {
      const score = scores[dim.name] ?? 10;
      const dimIssues: string[] = [];

      if (score < 10) {
        dimIssues.push(`${dim.name} score reduced to ${score.toFixed(1)} — ${dim.description}`);
      }

      dimensions[dim.name] = { score, weight: dim.weight, issues: dimIssues };

      if (dimIssues.length > 0) {
        issues.push(...dimIssues);
      }
    }

    // Add raw error details to issues
    for (const err of errors) {
      issues.push(`Error: ${err}`);
    }

    if (!hasFiles) {
      issues.push('No files were modified — task may be incomplete.');
    }

    const overallScore = computeWeightedScore(scores);
    const passed = overallScore >= this.minScore;

    const notes = [
      `Files modified: ${filesModified.length}`,
      `Errors: ${errors.length}`,
      `Min score: ${this.minScore}`,
    ].join(', ');

    return {
      sessionId: workResult.sessionId,
      score: overallScore,
      dimensions,
      passed,
      issues,
      notes,
    };
  }

  /**
   * Compute a score starting at `base`, applying deductions.
   * Each deduction is [condition, delta]. Clamps to [0, 10].
   */
  private _score(base: number, deductions: [boolean, number][]): number {
    let score = base;
    for (const [condition, delta] of deductions) {
      if (condition) score += delta;
    }
    return Math.max(0, Math.min(10, score));
  }

  /** Returns true if any of the given substrings appear in `text` */
  private _detectPattern(text: string, patterns: string[]): boolean {
    return patterns.some(p => text.includes(p));
  }
}
