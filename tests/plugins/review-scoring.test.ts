/**
 * Tests for L3 review/scoring module.
 * Covers REVIEW_DIMENSIONS structure and computeWeightedScore logic.
 */
import { describe, it, expect } from 'bun:test';
import { REVIEW_DIMENSIONS, computeWeightedScore } from '../../src/plugins/review/scoring.ts';

describe('REVIEW_DIMENSIONS', () => {
  it('has exactly 10 dimensions', () => {
    expect(REVIEW_DIMENSIONS).toHaveLength(10);
  });

  it('all dimensions have required fields (name, weight, description)', () => {
    for (const dim of REVIEW_DIMENSIONS) {
      expect(typeof dim.name).toBe('string');
      expect(dim.name.length).toBeGreaterThan(0);
      expect(typeof dim.weight).toBe('number');
      expect(typeof dim.description).toBe('string');
      expect(dim.description.length).toBeGreaterThan(0);
    }
  });

  it('weights sum to 1.0 (within floating point tolerance)', () => {
    const total = REVIEW_DIMENSIONS.reduce((sum, d) => sum + d.weight, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  it('all weights are positive', () => {
    for (const dim of REVIEW_DIMENSIONS) {
      expect(dim.weight).toBeGreaterThan(0);
    }
  });

  it('all weights are less than or equal to 1', () => {
    for (const dim of REVIEW_DIMENSIONS) {
      expect(dim.weight).toBeLessThanOrEqual(1);
    }
  });

  it('dimension names are unique', () => {
    const names = REVIEW_DIMENSIONS.map(d => d.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('includes expected dimension names', () => {
    const names = REVIEW_DIMENSIONS.map(d => d.name);
    expect(names).toContain('correctness');
    expect(names).toContain('architecture');
    expect(names).toContain('error-handling');
    expect(names).toContain('type-safety');
    expect(names).toContain('security');
    expect(names).toContain('performance');
    expect(names).toContain('maintainability');
    expect(names).toContain('completeness');
    expect(names).toContain('testing-surface');
    expect(names).toContain('documentation');
  });
});

describe('computeWeightedScore', () => {
  it('returns 10.0 when all dimensions score perfect 10', () => {
    const scores: Record<string, number> = {};
    for (const dim of REVIEW_DIMENSIONS) {
      scores[dim.name] = 10;
    }
    const result = computeWeightedScore(scores);
    expect(result).toBeCloseTo(10.0, 10);
  });

  it('returns 0.0 when all dimensions score 0', () => {
    const scores: Record<string, number> = {};
    for (const dim of REVIEW_DIMENSIONS) {
      scores[dim.name] = 0;
    }
    const result = computeWeightedScore(scores);
    expect(result).toBeCloseTo(0.0, 10);
  });

  it('returns 0 when no matching dimensions found (empty input)', () => {
    const result = computeWeightedScore({});
    expect(result).toBe(0);
  });

  it('returns 0 when input has no keys matching any dimension', () => {
    const result = computeWeightedScore({ 'nonexistent-dimension': 10 });
    expect(result).toBe(0);
  });

  it('handles mixed scores correctly (weighted average)', () => {
    // correctness weight=0.15, score=10; everything else weight=(1-0.15), score=0
    // normalized: (10*0.15) / 0.15 = 10 for only correctness
    const result = computeWeightedScore({ correctness: 10 });
    expect(result).toBeCloseTo(10.0, 10);
  });

  it('returns normalized result when only a subset of dimensions are scored', () => {
    // Two equal-weight approximations: correctness (0.15) and documentation (0.06)
    // Both score 5: (5*0.15 + 5*0.06) / (0.15 + 0.06) = 5
    const result = computeWeightedScore({ correctness: 5, documentation: 5 });
    expect(result).toBeCloseTo(5.0, 10);
  });

  it('handles score of 5 across all dimensions (midpoint)', () => {
    const scores: Record<string, number> = {};
    for (const dim of REVIEW_DIMENSIONS) {
      scores[dim.name] = 5;
    }
    const result = computeWeightedScore(scores);
    expect(result).toBeCloseTo(5.0, 10);
  });

  it('computes correct weighted result with asymmetric scores', () => {
    // Use correctness (weight 0.15) = 10 and architecture (weight 0.12) = 0
    // result = (10*0.15 + 0*0.12) / (0.15+0.12) = 1.5/0.27 ≈ 5.555...
    const result = computeWeightedScore({ correctness: 10, architecture: 0 });
    const expected = (10 * 0.15 + 0 * 0.12) / (0.15 + 0.12);
    expect(result).toBeCloseTo(expected, 8);
  });

  it('boundary: score of exactly 10 returns 10', () => {
    const scores: Record<string, number> = {};
    for (const dim of REVIEW_DIMENSIONS) {
      scores[dim.name] = 10;
    }
    expect(computeWeightedScore(scores)).toBeCloseTo(10, 10);
  });
});
