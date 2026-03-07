/**
 * Tests for L3 CodeFixer.
 * Covers IFixer interface compliance, severity categorization, and idempotency.
 */
import { describe, it, expect } from 'bun:test';
import { CodeFixer } from '../../src/plugins/review/fixer.ts';
import type { ReviewResult } from '../../src/types/registry.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReviewResult(overrides: Partial<ReviewResult> = {}): ReviewResult {
  return {
    sessionId: 'session-1',
    score: 8.5,
    dimensions: {},
    passed: false,
    issues: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Interface compliance
// ---------------------------------------------------------------------------

describe('CodeFixer — interface compliance', () => {
  it('has fix() method', () => {
    const fixer = new CodeFixer();
    expect(typeof fixer.fix).toBe('function');
  });

  it('fix() returns a Promise', () => {
    const fixer = new CodeFixer();
    const result = fixer.fix(makeReviewResult());
    expect(result instanceof Promise).toBe(true);
    return result;
  });

  it('fix() resolves to FixResult with required fields', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult());
    expect(typeof result.sessionId).toBe('string');
    expect(typeof result.success).toBe('boolean');
    expect(Array.isArray(result.filesModified)).toBe(true);
    expect(Array.isArray(result.resolvedIssues)).toBe(true);
    expect(Array.isArray(result.remainingIssues)).toBe(true);
  });

  it('preserves sessionId from reviewResult', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({ sessionId: 'sess-xyz' }));
    expect(result.sessionId).toBe('sess-xyz');
  });
});

// ---------------------------------------------------------------------------
// Severity categorization
// ---------------------------------------------------------------------------

describe('CodeFixer — severity categorization', () => {
  it('success=true when there are no issues', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({ issues: [] }));
    expect(result.success).toBe(true);
    expect(result.remainingIssues).toHaveLength(0);
    expect(result.resolvedIssues).toHaveLength(0);
  });

  it('critical issues stay in remainingIssues', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({
      issues: ['critical: null pointer dereference'],
    }));
    expect(result.remainingIssues).toHaveLength(1);
    expect(result.remainingIssues[0]).toContain('critical');
    expect(result.resolvedIssues).toHaveLength(0);
    expect(result.success).toBe(false);
  });

  it('major issues stay in remainingIssues', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({
      issues: ['major: missing input validation'],
    }));
    expect(result.remainingIssues).toHaveLength(1);
    expect(result.success).toBe(false);
  });

  it('[critical] tag issues stay in remainingIssues', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({
      issues: ['[critical] security vulnerability'],
    }));
    expect(result.remainingIssues).toHaveLength(1);
    expect(result.success).toBe(false);
  });

  it('[major] tag issues stay in remainingIssues', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({
      issues: ['[major] performance regression'],
    }));
    expect(result.remainingIssues).toHaveLength(1);
    expect(result.success).toBe(false);
  });

  it('error: prefix issues stay in remainingIssues', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({
      issues: ['error: type mismatch on line 42'],
    }));
    expect(result.remainingIssues).toHaveLength(1);
    expect(result.success).toBe(false);
  });

  it('build failed issues stay in remainingIssues', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({
      issues: ['build failed: compilation error in module'],
    }));
    expect(result.remainingIssues).toHaveLength(1);
    expect(result.success).toBe(false);
  });

  it('minor issues go to resolvedIssues with acknowledged prefix', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({
      issues: ['minor: variable name could be more descriptive'],
    }));
    expect(result.resolvedIssues).toHaveLength(1);
    expect(result.resolvedIssues[0]).toMatch(/^acknowledged:/);
    expect(result.remainingIssues).toHaveLength(0);
    expect(result.success).toBe(true);
  });

  it('nitpick issues go to resolvedIssues', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({
      issues: ['consider using const instead of let'],
    }));
    expect(result.resolvedIssues).toHaveLength(1);
    expect(result.remainingIssues).toHaveLength(0);
    expect(result.success).toBe(true);
  });

  it('mixed critical and minor issues are split correctly', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({
      issues: [
        'critical: memory leak in event handler',
        'minor: unnecessary whitespace',
        'major: missing null check',
        'style: prefer arrow function',
      ],
    }));
    expect(result.remainingIssues).toHaveLength(2); // critical + major
    expect(result.resolvedIssues).toHaveLength(2); // minor + style
    expect(result.success).toBe(false);
  });

  it('filesModified is always empty (passthrough fixer)', async () => {
    const fixer = new CodeFixer();
    const result = await fixer.fix(makeReviewResult({
      issues: ['some issue'],
    }));
    expect(result.filesModified).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe('CodeFixer — idempotency', () => {
  it('same input produces same output on repeated calls', async () => {
    const fixer = new CodeFixer();
    const reviewResult = makeReviewResult({
      issues: [
        'critical: null pointer',
        'minor: rename variable',
        'major: missing validation',
      ],
    });
    const result1 = await fixer.fix(reviewResult);
    const result2 = await fixer.fix(reviewResult);
    expect(result1.success).toBe(result2.success);
    expect(result1.resolvedIssues).toEqual(result2.resolvedIssues);
    expect(result1.remainingIssues).toEqual(result2.remainingIssues);
    expect(result1.filesModified).toEqual(result2.filesModified);
  });

  it('empty issues list is idempotent', async () => {
    const fixer = new CodeFixer();
    const reviewResult = makeReviewResult({ issues: [] });
    const result1 = await fixer.fix(reviewResult);
    const result2 = await fixer.fix(reviewResult);
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.resolvedIssues).toEqual(result2.resolvedIssues);
    expect(result1.remainingIssues).toEqual(result2.remainingIssues);
  });
});
