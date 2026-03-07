/**
 * Tests for ReviewPlugin registration.
 * Uses real L1 Registry instances.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { Registry } from '../../src/core/registry.ts';
import { ReviewPlugin } from '../../src/plugins/review/index.ts';
import type { IReviewer, IFixer } from '../../src/types/registry.ts';

describe('ReviewPlugin registration', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  it('register() does not throw', () => {
    expect(() => ReviewPlugin.register(registry)).not.toThrow();
  });

  it('registers fixer under single key "fixer"', () => {
    ReviewPlugin.register(registry);
    expect(registry.has('fixer')).toBe(true);
  });

  it('registered fixer implements IFixer (has fix method)', () => {
    ReviewPlugin.register(registry);
    const fixer = registry.get<IFixer>('fixer');
    expect(typeof fixer.fix).toBe('function');
  });

  it('registers reviewer under multi-value kind "reviewer"', () => {
    ReviewPlugin.register(registry);
    expect(registry.hasMany('reviewer')).toBe(true);
  });

  it('reviewer is retrievable via getAll("reviewer")', () => {
    ReviewPlugin.register(registry);
    const reviewers = registry.getAll<IReviewer>('reviewer');
    expect(reviewers).toHaveLength(1);
  });

  it('registered reviewer has id "code-review"', () => {
    ReviewPlugin.register(registry);
    const reviewer = registry.getFromKind<IReviewer>('reviewer', 'code-review');
    expect(reviewer).toBeDefined();
    expect(reviewer!.id).toBe('code-review');
  });

  it('registered reviewer implements IReviewer (has review method)', () => {
    ReviewPlugin.register(registry);
    const reviewer = registry.getFromKind<IReviewer>('reviewer', 'code-review');
    expect(reviewer).toBeDefined();
    expect(typeof reviewer!.review).toBe('function');
  });

  it('registered reviewer has capabilities array', () => {
    ReviewPlugin.register(registry);
    const reviewer = registry.getFromKind<IReviewer>('reviewer', 'code-review');
    expect(Array.isArray(reviewer!.capabilities)).toBe(true);
  });

  it('manifest has correct name, layer, and capabilities', () => {
    expect(ReviewPlugin.manifest.name).toBe('review');
    expect(ReviewPlugin.manifest.layer).toBe('L3');
    expect(ReviewPlugin.manifest.capabilities).toContain('review');
    expect(ReviewPlugin.manifest.capabilities).toContain('fix');
  });

  it('shutdown() resolves without error', async () => {
    await expect(ReviewPlugin.shutdown()).resolves.toBeUndefined();
  });
});
