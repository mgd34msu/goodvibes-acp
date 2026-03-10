/**
 * Tests for L3 review/scoring-engine module.
 * Covers calculateScore and scoreBreakdown with all severity types,
 * cap behavior, clamping, and custom config overrides.
 */
import { describe, it, expect } from 'bun:test';
import { calculateScore, scoreBreakdown } from '../../src/plugins/review/scoring-engine.ts';
import { DEFAULT_SCORING_CONFIG } from '../../src/plugins/review/types.ts';
import type { ReviewIssue, ScoringConfig } from '../../src/plugins/review/types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIssue(severity: ReviewIssue['severity']): ReviewIssue {
  return { severity, file: 'src/foo.ts', title: 'T', description: 'D' };
}

function issues(...severities: ReviewIssue['severity'][]): ReviewIssue[] {
  return severities.map(makeIssue);
}

// ---------------------------------------------------------------------------
// calculateScore
// ---------------------------------------------------------------------------

describe('calculateScore', () => {
  it('returns 10.0 for empty issue list', () => {
    expect(calculateScore([])).toBe(10.0);
  });

  it('deducts 2.0 for a single critical issue', () => {
    // base 10 + 1 * -2.0 = 8.0; cap is -6.0, so max(-6.0, -2.0) = -2.0
    expect(calculateScore(issues('critical'))).toBe(8.0);
  });

  it('deducts 0.5 for a single major issue', () => {
    expect(calculateScore(issues('major'))).toBe(9.5);
  });

  it('deducts 0.1 for a single minor issue', () => {
    expect(calculateScore(issues('minor'))).toBe(9.9);
  });

  it('deducts nothing for a single nitpick issue', () => {
    expect(calculateScore(issues('nitpick'))).toBe(10.0);
  });

  it('deducts nothing for multiple nitpick issues', () => {
    expect(calculateScore(issues('nitpick', 'nitpick', 'nitpick'))).toBe(10.0);
  });

  it('caps critical deduction at -6.0 (3 criticals = cap)', () => {
    // 3 * -2.0 = -6.0 exactly hits the cap
    expect(calculateScore(issues('critical', 'critical', 'critical'))).toBe(4.0);
  });

  it('applies cap when criticals exceed cap threshold', () => {
    // 5 * -2.0 = -10 but cap is -6.0 → score = 10 + (-6.0) = 4.0
    const score = calculateScore(issues('critical', 'critical', 'critical', 'critical', 'critical'));
    expect(score).toBe(4.0);
  });

  it('caps major deduction at -3.0 (6+ majors)', () => {
    // 6 * -0.5 = -3.0 exactly hits the major cap
    const sixes = issues('major', 'major', 'major', 'major', 'major', 'major');
    expect(calculateScore(sixes)).toBe(7.0);
  });

  it('applies major cap when majors exceed cap threshold', () => {
    const many = Array(10).fill(null).map(() => makeIssue('major'));
    // 10 * -0.5 = -5.0 but cap is -3.0 → 10 + (-3.0) = 7.0
    expect(calculateScore(many)).toBe(7.0);
  });

  it('caps minor deduction at -1.0 (10+ minors)', () => {
    const ten = Array(10).fill(null).map(() => makeIssue('minor'));
    // 10 * -0.1 = -1.0 exactly hits the minor cap
    expect(calculateScore(ten)).toBe(9.0);
  });

  it('applies minor cap when minors exceed cap threshold', () => {
    const many = Array(20).fill(null).map(() => makeIssue('minor'));
    // 20 * -0.1 = -2.0 but cap is -1.0 → 10 + (-1.0) = 9.0
    expect(calculateScore(many)).toBe(9.0);
  });

  it('clamps score to 0 when deductions exceed base', () => {
    // 3 criticals (-6) + 6 majors (-3) + 10 minors (-1) = -10 → base 10 - 10 = 0
    const all = [
      ...Array(3).fill(null).map(() => makeIssue('critical')),
      ...Array(6).fill(null).map(() => makeIssue('major')),
      ...Array(10).fill(null).map(() => makeIssue('minor')),
    ];
    expect(calculateScore(all)).toBe(0.0);
  });

  it('score is always >= 0 even with extreme inputs', () => {
    const extreme = Array(100).fill(null).map(() => makeIssue('critical'));
    expect(calculateScore(extreme)).toBeGreaterThanOrEqual(0);
  });

  it('score is always <= 10', () => {
    expect(calculateScore([])).toBeLessThanOrEqual(10);
  });

  it('computes mixed severity score correctly', () => {
    // 1 critical (-2) + 1 major (-0.5) + 1 minor (-0.1) = -2.6 → 7.4
    const score = calculateScore(issues('critical', 'major', 'minor'));
    expect(score).toBe(7.4);
  });

  it('nitpicks do not affect mixed score', () => {
    const withNitpick = calculateScore(issues('critical', 'major', 'minor', 'nitpick'));
    const without = calculateScore(issues('critical', 'major', 'minor'));
    expect(withNitpick).toBe(without);
  });

  it('respects custom base config', () => {
    const config: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, base: 8.0 };
    expect(calculateScore([], config)).toBe(8.0);
  });

  it('respects custom criticalPenalty', () => {
    const config: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, criticalPenalty: -1.0, criticalCap: -5.0 };
    expect(calculateScore(issues('critical'), config)).toBe(9.0);
  });

  it('respects custom majorPenalty', () => {
    const config: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, majorPenalty: -1.0, majorCap: -5.0 };
    expect(calculateScore(issues('major'), config)).toBe(9.0);
  });

  it('respects custom minorPenalty', () => {
    const config: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, minorPenalty: -0.5, minorCap: -2.0 };
    expect(calculateScore(issues('minor'), config)).toBe(9.5);
  });

  it('result is rounded to 1 decimal place', () => {
    // 1 minor = -0.1 → 9.9 (already clean)
    const score = calculateScore(issues('minor'));
    expect(score.toString()).toMatch(/^\d+\.?\d?$/);
  });
});

// ---------------------------------------------------------------------------
// scoreBreakdown
// ---------------------------------------------------------------------------

describe('scoreBreakdown', () => {
  it('returns correct structure for empty issues', () => {
    const result = scoreBreakdown([]);
    expect(result.score).toBe(10.0);
    expect(result.counts).toEqual({ critical: 0, major: 0, minor: 0, nitpick: 0 });
    // Math.max(-6.0, 0 * -2.0) = Math.max(-6.0, -0) = -0 in JS; add 0 to normalize
    expect(result.deductions.critical + 0).toBe(0);
    expect(result.deductions.major + 0).toBe(0);
    expect(result.deductions.minor + 0).toBe(0);
    expect(result.deductions.nitpick).toBe(0);
  });

  it('counts each severity correctly', () => {
    const result = scoreBreakdown([
      ...issues('critical', 'critical'),
      ...issues('major'),
      ...issues('minor', 'minor', 'minor'),
      ...issues('nitpick', 'nitpick'),
    ]);
    expect(result.counts).toEqual({ critical: 2, major: 1, minor: 3, nitpick: 2 });
  });

  it('deductions match calculateScore for same input', () => {
    const issueList = issues('critical', 'major', 'minor', 'nitpick');
    const breakdown = scoreBreakdown(issueList);
    expect(breakdown.score).toBe(calculateScore(issueList));
  });

  it('critical deduction is negative (or zero)', () => {
    const result = scoreBreakdown(issues('critical'));
    expect(result.deductions.critical).toBeLessThanOrEqual(0);
  });

  it('major deduction is negative (or zero)', () => {
    const result = scoreBreakdown(issues('major'));
    expect(result.deductions.major).toBeLessThanOrEqual(0);
  });

  it('minor deduction is negative (or zero)', () => {
    const result = scoreBreakdown(issues('minor'));
    expect(result.deductions.minor).toBeLessThanOrEqual(0);
  });

  it('nitpick deduction is always 0', () => {
    const result = scoreBreakdown(issues('nitpick', 'nitpick', 'nitpick'));
    expect(result.deductions.nitpick).toBe(0);
  });

  it('applies cap for critical deductions in breakdown', () => {
    // 5 criticals: 5 * -2.0 = -10 but cap is -6.0
    const result = scoreBreakdown(Array(5).fill(null).map(() => makeIssue('critical')));
    expect(result.deductions.critical).toBe(-6.0);
  });

  it('applies cap for major deductions in breakdown', () => {
    // 10 majors: 10 * -0.5 = -5.0 but cap is -3.0
    const result = scoreBreakdown(Array(10).fill(null).map(() => makeIssue('major')));
    expect(result.deductions.major).toBe(-3.0);
  });

  it('applies cap for minor deductions in breakdown', () => {
    // 20 minors: 20 * -0.1 = -2.0 but cap is -1.0
    const result = scoreBreakdown(Array(20).fill(null).map(() => makeIssue('minor')));
    expect(result.deductions.minor).toBe(-1.0);
  });

  it('score is clamped to 0 in breakdown', () => {
    // Max caps: critical(-6) + major(-3) + minor(-1) = -10 -> base 10 + (-10) = 0
    const extreme = [
      ...Array(10).fill(null).map(() => makeIssue('critical')),  // capped at -6
      ...Array(10).fill(null).map(() => makeIssue('major')),     // capped at -3
      ...Array(20).fill(null).map(() => makeIssue('minor')),     // capped at -1
    ];
    const result = scoreBreakdown(extreme);
    expect(result.score).toBe(0.0);
  });

  it('uses custom config when provided', () => {
    const config: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, criticalPenalty: -3.0, criticalCap: -9.0 };
    const result = scoreBreakdown(issues('critical'), config);
    expect(result.deductions.critical).toBe(-3.0);
    expect(result.score).toBe(7.0);
  });
});
