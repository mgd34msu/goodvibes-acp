/**
 * @module review/review-tool-provider
 * @layer L3 — plugin
 *
 * IToolProvider that exposes a single `submit_review` tool to the LLM reviewer
 * agent. Validates that referenced files were actually read during the session
 * (stripping hallucinated references), stores the result for retrieval by the
 * WRFC orchestrator.
 *
 * Usage:
 * 1. Call reset() at the start of each review session
 * 2. Call trackFileRead(path) whenever the reviewer agent reads a file
 * 3. The agent calls submit_review via this provider
 * 4. Call consumeReview() to retrieve the result
 */

import type { IToolProvider, ToolDefinition, ToolResult } from '../../types/registry.js';
import type { ReviewIssue, SubmitReviewInput, ReviewReference } from './types.js';

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Tool provider that exposes the `submit_review` tool to LLM reviewer agents.
 *
 * Thread safety: not designed for concurrent review sessions. Reset between sessions.
 */
export class ReviewToolProvider implements IToolProvider {
  readonly name = 'review';

  private _lastReview: SubmitReviewInput | null = null;
  private _filesRead = new Set<string>();

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Track that the reviewer agent read a file during the current session.
   * References to files not tracked here will be stripped on submit.
   *
   * @param filePath - Absolute or relative path that was read
   */
  trackFileRead(filePath: string): void {
    this._filesRead.add(filePath);
  }

  /**
   * Reset all tracking state for a new review session.
   * Must be called before each new review to prevent stale state.
   */
  reset(): void {
    this._lastReview = null;
    this._filesRead.clear();
  }

  // ---------------------------------------------------------------------------
  // IToolProvider
  // ---------------------------------------------------------------------------

  get tools(): ToolDefinition[] {
    return [{
      name: 'submit_review',
      description:
        'Submit your code review findings. Call this tool ONCE at the end of your review ' +
        'with all issues found. Each issue should include severity (critical/major/minor/nitpick), ' +
        'file path, title, description, and optionally references to related code patterns found ' +
        'during your review.',
      inputSchema: {
        type: 'object',
        required: ['issues', 'summary'],
        properties: {
          summary: {
            type: 'string',
            description: 'Brief summary of the review findings (1-3 sentences)',
          },
          issues: {
            type: 'array',
            description: 'Array of issues found during review. Empty array if no issues.',
            items: {
              type: 'object',
              required: ['severity', 'file', 'title', 'description'],
              properties: {
                severity: {
                  type: 'string',
                  enum: ['critical', 'major', 'minor', 'nitpick'],
                  description:
                    'critical: security, data loss, crashes. major: logic errors, missing validation. ' +
                    'minor: style, missing types. nitpick: preferences, formatting.',
                },
                file: {
                  type: 'string',
                  description: 'File path where the issue was found',
                },
                line: {
                  type: 'number',
                  description: 'Line number (optional)',
                },
                title: {
                  type: 'string',
                  description:
                    'Short title identifying the issue (used as issue identifier for the fixer)',
                },
                description: {
                  type: 'string',
                  description:
                    'Detailed description: what is wrong, why it matters, and how to fix it. ' +
                    'The fixer receives this directly so be specific.',
                },
                references: {
                  type: 'array',
                  description:
                    'Optional references to related files you read during this review that ' +
                    'demonstrate correct patterns or provide context for the fix.',
                  items: {
                    type: 'object',
                    required: ['file', 'note'],
                    properties: {
                      file: {
                        type: 'string',
                        description: 'File path (must be a file you already read during this review)',
                      },
                      line: {
                        type: 'number',
                        description: 'Line number (optional)',
                      },
                      note: {
                        type: 'string',
                        description:
                          'Why this reference is relevant (e.g., "Example of correct error handling pattern")',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }];
  }

  /**
   * Execute a named tool.
   *
   * Only `submit_review` is supported. Returns an error result for unknown tools.
   */
  async execute<T = unknown>(toolName: string, input: unknown): Promise<ToolResult<T>> {
    if (toolName !== 'submit_review') {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    const reviewInput = input as SubmitReviewInput;

    // Validate and strip hallucinated references
    let strippedCount = 0;
    for (const issue of reviewInput.issues) {
      if (issue.references && issue.references.length > 0) {
        const validRefs: ReviewReference[] = [];
        for (const ref of issue.references) {
          if (this._filesRead.has(ref.file)) {
            validRefs.push(ref);
          } else {
            strippedCount++;
            console.error(
              `[ReviewToolProvider] Stripped hallucinated reference: ${ref.file} (not read during review)`,
            );
          }
        }
        issue.references = validRefs.length > 0 ? validRefs : undefined;
      }
    }

    this._lastReview = reviewInput;

    const counts = {
      critical: reviewInput.issues.filter(i => i.severity === 'critical').length,
      major:    reviewInput.issues.filter(i => i.severity === 'major').length,
      minor:    reviewInput.issues.filter(i => i.severity === 'minor').length,
      nitpick:  reviewInput.issues.filter(i => i.severity === 'nitpick').length,
    };

    let result =
      `Review submitted: ${reviewInput.issues.length} issues ` +
      `(${counts.critical}C/${counts.major}M/${counts.minor}m/${counts.nitpick}n)`;

    if (strippedCount > 0) {
      result += ` — ${strippedCount} hallucinated reference(s) stripped`;
    }

    return { success: true, data: result as T };
  }

  // ---------------------------------------------------------------------------
  // Result retrieval
  // ---------------------------------------------------------------------------

  /**
   * Retrieve the last submitted review and clear it from internal state.
   * Returns null if no review has been submitted since the last reset().
   */
  consumeReview(): SubmitReviewInput | null {
    const review = this._lastReview;
    this._lastReview = null;
    return review;
  }
}
