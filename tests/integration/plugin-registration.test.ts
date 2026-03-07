/**
 * @file plugin-registration.test.ts
 * @description Integration tests for ReviewPlugin and AgentsPlugin registration
 * into a real L1 Registry instance.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Registry } from '../../src/core/registry.js';
import { ReviewPlugin } from '../../src/plugins/review/index.js';
import { AgentsPlugin } from '../../src/plugins/agents/index.js';
import type { IReviewer, IFixer, IAgentSpawner } from '../../src/types/registry.js';

// ---------------------------------------------------------------------------
// ReviewPlugin registration
// ---------------------------------------------------------------------------

describe('ReviewPlugin registration into real Registry', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    ReviewPlugin.register(registry);
  });

  test('registers fixer under single-value key "fixer"', () => {
    expect(registry.has('fixer')).toBe(true);
  });

  test('registers reviewer under multi-value kind "reviewer" with key "code-review"', () => {
    expect(registry.hasMany('reviewer', 'code-review')).toBe(true);
  });

  test('fixer implementation is callable (has fix method)', () => {
    const fixer = registry.get<IFixer>('fixer');
    expect(typeof fixer.fix).toBe('function');
  });

  test('reviewer implementation is callable (has review method)', () => {
    const reviewers = registry.getAll<IReviewer>('reviewer');
    expect(reviewers.length).toBeGreaterThan(0);
    expect(typeof reviewers[0].review).toBe('function');
  });

  test('reviewer has id and capabilities', () => {
    const reviewers = registry.getAll<IReviewer>('reviewer');
    const reviewer = reviewers[0];
    expect(typeof reviewer.id).toBe('string');
    expect(reviewer.id.length).toBeGreaterThan(0);
    expect(Array.isArray(reviewer.capabilities)).toBe(true);
  });

  test('fixer.fix returns a FixResult with expected shape', async () => {
    const fixer = registry.get<IFixer>('fixer');
    const result = await fixer.fix({
      sessionId: 'test-sess',
      score: 4.0,
      dimensions: { quality: { score: 4.0, weight: 1.0, issues: ['missing tests'] } },
      passed: false,
      issues: ['missing tests'],
    });
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.sessionId).toBe('string');
    expect(Array.isArray(result.filesModified)).toBe(true);
    expect(Array.isArray(result.resolvedIssues)).toBe(true);
    expect(Array.isArray(result.remainingIssues)).toBe(true);
  });

  test('reviewer.review returns a ReviewResult with expected shape', async () => {
    const reviewers = registry.getAll<IReviewer>('reviewer');
    const reviewer = reviewers[0];
    const result = await reviewer.review({
      sessionId: 'test-sess',
      task: 'Write a function',
      output: 'function add(a, b) { return a + b; }',
      filesModified: ['src/math.ts'],
      errors: [],
      durationMs: 100,
    });
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(typeof result.passed).toBe('boolean');
    expect(typeof result.sessionId).toBe('string');
    expect(Array.isArray(result.issues)).toBe(true);
  });

  test('registering ReviewPlugin twice throws duplicate key error', () => {
    expect(() => ReviewPlugin.register(registry)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// AgentsPlugin registration
// ---------------------------------------------------------------------------

describe('AgentsPlugin registration into real Registry', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    AgentsPlugin.register(registry);
  });

  test('registers agent-spawner under single-value key "agent-spawner"', () => {
    expect(registry.has('agent-spawner')).toBe(true);
  });

  test('agent-spawner implementation is callable (has spawn method)', () => {
    const spawner = registry.get<IAgentSpawner>('agent-spawner');
    expect(typeof spawner.spawn).toBe('function');
  });

  test('agent-spawner has result, cancel, and status methods', () => {
    const spawner = registry.get<IAgentSpawner>('agent-spawner');
    expect(typeof spawner.result).toBe('function');
    expect(typeof spawner.cancel).toBe('function');
    expect(typeof spawner.status).toBe('function');
  });

  test('registering AgentsPlugin twice throws duplicate key error', () => {
    expect(() => AgentsPlugin.register(registry)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Both plugins together
// ---------------------------------------------------------------------------

describe('ReviewPlugin + AgentsPlugin together in same Registry', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    ReviewPlugin.register(registry);
    AgentsPlugin.register(registry);
  });

  test('all expected keys are registered in single-value registry', () => {
    const keys = registry.keys();
    expect(keys).toContain('fixer');
    expect(keys).toContain('agent-spawner');
  });

  test('reviewer kind is registered in multi-value registry', () => {
    const kinds = registry.kinds();
    expect(kinds).toContain('reviewer');
  });

  test('all registered implementations are callable', () => {
    const fixer = registry.get<IFixer>('fixer');
    const spawner = registry.get<IAgentSpawner>('agent-spawner');
    const reviewers = registry.getAll<IReviewer>('reviewer');

    expect(typeof fixer.fix).toBe('function');
    expect(typeof spawner.spawn).toBe('function');
    expect(reviewers.length).toBeGreaterThan(0);
    expect(typeof reviewers[0].review).toBe('function');
  });
});
