/**
 * @module fixer
 * @layer L3 — plugin
 *
 * Passthrough fixer implementing IFixer.
 * Acknowledges review issues and categorizes them by severity.
 * Actual AI-powered fix implementation is a future enhancement.
 *
 * MUST be idempotent — running fix twice produces the same output.
 */

import type { IFixer, ReviewResult, FixResult } from '../../types/registry.js';

// ---------------------------------------------------------------------------
// Severity categorization helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if an issue string represents a critical or major severity.
 * Heuristic: checks for known severity prefixes in the issue text.
 */
function isMandatoryFix(issue: string): boolean {
  const lower = issue.toLowerCase();
  return (
    lower.startsWith('critical') ||
    lower.startsWith('major') ||
    lower.includes('[critical]') ||
    lower.includes('[major]') ||
    lower.startsWith('error:') ||
    lower.includes('build failed') ||
    lower.includes('compilation failed')
  );
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Passthrough fixer that acknowledges issues from a ReviewResult.
 *
 * Categorizes issues by severity:
 * - critical/major → must-fix (reported as remaining until AI fixer is available)
 * - minor/nitpick → acknowledged as resolved (lower priority)
 *
 * Idempotent: running fix on the same ReviewResult always produces identical output.
 */
export class CodeFixer implements IFixer {
  /**
   * Apply fixes based on the review result.
   * This initial implementation acknowledges issues without modifying files.
   * AI-powered fix application will be added in a future iteration.
   */
  async fix(reviewResult: ReviewResult): Promise<FixResult> {
    const resolvedIssues: string[] = [];
    const remainingIssues: string[] = [];

    for (const issue of reviewResult.issues) {
      if (isMandatoryFix(issue)) {
        // Critical/major issues require AI-powered fixes — mark as remaining
        remainingIssues.push(issue);
      } else {
        // Minor/nitpick issues are acknowledged
        resolvedIssues.push(`acknowledged: ${issue}`);
      }
    }

    return {
      sessionId: reviewResult.sessionId,
      success: remainingIssues.length === 0,
      filesModified: [],
      resolvedIssues,
      remainingIssues,
    };
  }
}
