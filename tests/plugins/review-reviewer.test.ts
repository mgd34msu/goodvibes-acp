/**
 * Tests for L3 CodeReviewer.
 * Covers IReviewer interface compliance, ReviewResult structure,
 * signal detection, and never-throws contract.
 */
import { describe, it, expect } from 'bun:test';
import { CodeReviewer } from '../../src/plugins/review/reviewer.ts';
import type { WorkResult } from '../../src/types/registry.ts';
import { REVIEW_DIMENSIONS } from '../../src/plugins/review/scoring.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkResult(overrides: Partial<WorkResult> = {}): WorkResult {
  return {
    sessionId: 'session-1',
    task: 'implement feature',
    output: '',
    filesModified: ['src/feature.ts'],
    errors: [],
    durationMs: 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Interface compliance
// ---------------------------------------------------------------------------

describe('CodeReviewer — interface compliance', () => {
  it('has readonly id string', () => {
    const reviewer = new CodeReviewer();
    expect(typeof reviewer.id).toBe('string');
    expect(reviewer.id.length).toBeGreaterThan(0);
  });

  it('has readonly capabilities array', () => {
    const reviewer = new CodeReviewer();
    expect(Array.isArray(reviewer.capabilities)).toBe(true);
    expect(reviewer.capabilities.length).toBeGreaterThan(0);
  });

  it('has review() method', () => {
    const reviewer = new CodeReviewer();
    expect(typeof reviewer.review).toBe('function');
  });

  it('review() returns a Promise', () => {
    const reviewer = new CodeReviewer();
    const result = reviewer.review(makeWorkResult());
    expect(result instanceof Promise).toBe(true);
    // clean up
    return result;
  });
});

// ---------------------------------------------------------------------------
// ReviewResult structure
// ---------------------------------------------------------------------------

describe('CodeReviewer — ReviewResult structure', () => {
  it('returns result with correct sessionId', async () => {
    const reviewer = new CodeReviewer();
    const result = await reviewer.review(makeWorkResult({ sessionId: 'sess-abc' }));
    expect(result.sessionId).toBe('sess-abc');
  });

  it('result score is a number between 0 and 10', async () => {
    const reviewer = new CodeReviewer();
    const result = await reviewer.review(makeWorkResult());
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it('result has dimensions object with all 10 dimension keys', async () => {
    const reviewer = new CodeReviewer();
    const result = await reviewer.review(makeWorkResult());
    expect(typeof result.dimensions).toBe('object');
    for (const dim of REVIEW_DIMENSIONS) {
      expect(result.dimensions[dim.name]).toBeDefined();
    }
  });

  it('each dimension has score, weight, and issues', async () => {
    const reviewer = new CodeReviewer();
    const result = await reviewer.review(makeWorkResult());
    for (const dim of REVIEW_DIMENSIONS) {
      const d = result.dimensions[dim.name];
      expect(typeof d.score).toBe('number');
      expect(typeof d.weight).toBe('number');
      expect(Array.isArray(d.issues)).toBe(true);
    }
  });

  it('result has passed boolean', async () => {
    const reviewer = new CodeReviewer();
    const result = await reviewer.review(makeWorkResult());
    expect(typeof result.passed).toBe('boolean');
  });

  it('result has issues array', async () => {
    const reviewer = new CodeReviewer();
    const result = await reviewer.review(makeWorkResult());
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('perfect work (files modified, no errors, clean output) scores high', async () => {
    const reviewer = new CodeReviewer();
    const result = await reviewer.review(makeWorkResult({
      filesModified: ['src/feature.ts'],
      errors: [],
      output: 'All checks passed.',
    }));
    expect(result.score).toBeGreaterThan(9);
    expect(result.passed).toBe(true);
  });

  it('work with errors scores lower than perfect', async () => {
    const reviewer = new CodeReviewer();
    const perfect = await reviewer.review(makeWorkResult());
    const withErrors = await reviewer.review(makeWorkResult({ errors: ['something went wrong'] }));
    expect(withErrors.score).toBeLessThan(perfect.score);
  });

  it('no files modified lowers completeness and correctness scores', async () => {
    const reviewer = new CodeReviewer();
    const withFiles = await reviewer.review(makeWorkResult({ filesModified: ['src/a.ts'] }));
    const noFiles = await reviewer.review(makeWorkResult({ filesModified: [] }));
    expect(noFiles.score).toBeLessThan(withFiles.score);
    // completeness score should be reduced
    expect(noFiles.dimensions['completeness'].score).toBeLessThan(withFiles.dimensions['completeness'].score);
  });
});

// ---------------------------------------------------------------------------
// Signal detection (deduction-based scoring)
// ---------------------------------------------------------------------------

describe('CodeReviewer — signal detection', () => {
  it('type errors in output lower type-safety score', async () => {
    const reviewer = new CodeReviewer();
    const clean = await reviewer.review(makeWorkResult({ output: 'Build succeeded' }));
    const withTypeErrors = await reviewer.review(makeWorkResult({ output: 'error TS2345: type error found' }));
    expect(withTypeErrors.dimensions['type-safety'].score).toBeLessThan(clean.dimensions['type-safety'].score);
  });

  it('build failures in output lower architecture and correctness scores', async () => {
    const reviewer = new CodeReviewer();
    const clean = await reviewer.review(makeWorkResult({ output: 'Build succeeded' }));
    const buildFailed = await reviewer.review(makeWorkResult({ output: 'build failed: compilation error' }));
    expect(buildFailed.dimensions['correctness'].score).toBeLessThan(clean.dimensions['correctness'].score);
    expect(buildFailed.dimensions['architecture'].score).toBeLessThan(clean.dimensions['architecture'].score);
  });

  it('test failures in output lower testing-surface and correctness scores', async () => {
    const reviewer = new CodeReviewer();
    const clean = await reviewer.review(makeWorkResult({ output: 'All tests pass' }));
    const testFailed = await reviewer.review(makeWorkResult({ output: '3 tests failed' }));
    expect(testFailed.dimensions['testing-surface'].score).toBeLessThan(clean.dimensions['testing-surface'].score);
    expect(testFailed.dimensions['correctness'].score).toBeLessThan(clean.dimensions['correctness'].score);
  });

  it('security warnings in output lower security score significantly', async () => {
    const reviewer = new CodeReviewer();
    const clean = await reviewer.review(makeWorkResult({ output: 'No issues found' }));
    const securityIssue = await reviewer.review(makeWorkResult({ output: 'WARNING: password exposed in plaintext' }));
    expect(securityIssue.dimensions['security'].score).toBeLessThan(clean.dimensions['security'].score);
  });

  it('performance warnings in output lower performance score', async () => {
    const reviewer = new CodeReviewer();
    const clean = await reviewer.review(makeWorkResult({ output: 'All good' }));
    const perfIssue = await reviewer.review(makeWorkResult({ output: 'Detected N+1 query pattern in loop' }));
    expect(perfIssue.dimensions['performance'].score).toBeLessThan(clean.dimensions['performance'].score);
  });

  it('lint errors in output lower maintainability score', async () => {
    const reviewer = new CodeReviewer();
    const clean = await reviewer.review(makeWorkResult({ output: 'No lint issues' }));
    const lintIssue = await reviewer.review(makeWorkResult({ output: '5 problems (2 error(s))' }));
    expect(lintIssue.dimensions['maintainability'].score).toBeLessThan(clean.dimensions['maintainability'].score);
  });
});

// ---------------------------------------------------------------------------
// Never-throws contract
// ---------------------------------------------------------------------------

describe('CodeReviewer — never-throws contract', () => {
  it('does not throw when review() is called with valid input', async () => {
    const reviewer = new CodeReviewer();
    await expect(reviewer.review(makeWorkResult())).resolves.toBeDefined();
  });

  it('returns score=0 with error details when workResult body is malformed (errors missing)', async () => {
    // Pass an object that has sessionId (so catch block can run) but is missing
    // required array fields — this triggers the catch path in _doReview
    const reviewer = new CodeReviewer();
    const malformed = {
      sessionId: 'sess-err',
      task: 'test',
      output: 'some output',
      // filesModified and errors deliberately omitted to trigger TypeError in _doReview
    } as unknown as WorkResult;
    const result = await reviewer.review(malformed);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.sessionId).toBe('sess-err');
  });

  it('returned result from error path contains all 10 dimension keys', async () => {
    const reviewer = new CodeReviewer();
    const malformed = {
      sessionId: 'sess-err2',
      // no output, errors, or filesModified — triggers TypeError
    } as unknown as WorkResult;
    const result = await reviewer.review(malformed);
    expect(Object.keys(result.dimensions)).toHaveLength(10);
    for (const dim of REVIEW_DIMENSIONS) {
      expect(result.dimensions[dim.name]).toBeDefined();
      expect(result.dimensions[dim.name].score).toBe(0);
    }
  });

  it('uses provided minScore option for passed determination', async () => {
    // With minScore=0, any score should pass
    const reviewer = new CodeReviewer({ minScore: 0 });
    const result = await reviewer.review(makeWorkResult({ errors: ['bad stuff'], filesModified: [] }));
    expect(result.passed).toBe(true);
  });

  it('uses default minScore of 9.5', async () => {
    // Perfect work should pass by default
    const reviewer = new CodeReviewer();
    const result = await reviewer.review(makeWorkResult({
      filesModified: ['src/a.ts'],
      errors: [],
      output: 'OK',
    }));
    expect(result.passed).toBe(result.score >= 9.5);
  });
});
