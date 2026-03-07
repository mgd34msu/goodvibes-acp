/**
 * @file wrfc-orchestrator.test.ts
 * @description Comprehensive tests for WRFCOrchestrator — the WRFC chain orchestrator.
 *
 * Covers:
 *  1. Happy path — work completes, review passes, returns complete
 *  2. Fix cycle — work completes, review fails, fixer runs, re-review passes
 *  3. Max attempts — review fails repeatedly, hits max attempts, returns escalated
 *  4. Cancellation — abort signal during work phase, returns cancelled state
 *  5. State transitions — idle → working → reviewing → complete
 *  6. Event emissions — wrfc:* events emitted on EventBus
 *  7. Error handling — reviewer throws, orchestrator handles gracefully
 *  8. Score tracking — lastScore is updated after each review
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import { WRFCOrchestrator } from '../../src/extensions/wrfc/orchestrator.js';
import type { WRFCCallbacks, WRFCRunParams } from '../../src/extensions/wrfc/orchestrator.js';
import type { WRFCConfig, WRFCContext } from '../../src/types/wrfc.js';
import type {
  WorkResult,
  ReviewResult,
  FixResult,
  IAgentSpawner,
  IReviewer,
  IFixer,
} from '../../src/types/registry.js';
import type { AgentHandle, AgentConfig, AgentResult } from '../../src/types/agent.js';

// ---------------------------------------------------------------------------
// Shared config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: WRFCConfig = {
  minReviewScore: 9.0,
  maxAttempts: 3,
  enableQualityGates: true,
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeHandle(): AgentHandle {
  return { id: 'mock-agent-1', type: 'engineer', spawnedAt: Date.now() };
}

function makeSpawner(options: {
  output?: string;
  filesModified?: string[];
  rejectWith?: Error;
} = {}): IAgentSpawner {
  const handle = makeHandle();
  const { output = 'agent output', filesModified = ['src/index.ts'], rejectWith } = options;
  return {
    async spawn(_config: AgentConfig): Promise<AgentHandle> {
      if (rejectWith) throw rejectWith;
      return handle;
    },
    async result(_handle: AgentHandle): Promise<AgentResult> {
      return {
        handle,
        status: 'completed',
        output,
        filesModified,
        errors: [],
        durationMs: 50,
      };
    },
    async cancel(_handle: AgentHandle): Promise<void> {},
    status(_handle: AgentHandle) {
      return 'completed' as const;
    },
  };
}

function makeReviewer(options: {
  score?: number;
  issues?: string[];
  throwError?: Error;
  scoreSequence?: number[];
} = {}): IReviewer {
  const { score = 9.5, issues = [], throwError, scoreSequence } = options;
  let callCount = 0;
  return {
    id: 'mock-reviewer',
    capabilities: ['typescript'],
    async review(workResult: WorkResult): Promise<ReviewResult> {
      if (throwError) throw throwError;
      callCount++;
      const currentScore = scoreSequence ? (scoreSequence[callCount - 1] ?? score) : score;
      const currentIssues = currentScore >= 9.0 ? [] : (issues.length ? issues : ['needs improvement']);
      return {
        sessionId: workResult.sessionId,
        score: currentScore,
        dimensions: {
          quality: { score: currentScore, weight: 1.0, issues: currentIssues },
        },
        passed: currentScore >= 9.0,
        issues: currentIssues,
      };
    },
  };
}

function makeFixer(options: {
  resolvedIssues?: string[];
  remainingIssues?: string[];
  filesModified?: string[];
} = {}): IFixer {
  const {
    resolvedIssues,
    remainingIssues = [],
    filesModified = ['src/index.ts'],
  } = options;
  return {
    async fix(reviewResult: ReviewResult): Promise<FixResult> {
      return {
        sessionId: reviewResult.sessionId,
        success: true,
        filesModified,
        resolvedIssues: resolvedIssues ?? reviewResult.issues,
        remainingIssues,
      };
    },
  };
}

type TrackingCallbacks = WRFCCallbacks & {
  stateChanges: Array<{ from: string; to: string }>;
  workResults: WorkResult[];
  reviewResults: ReviewResult[];
  fixResults: FixResult[];
};

function makeCallbacks(): TrackingCallbacks {
  const stateChanges: Array<{ from: string; to: string }> = [];
  const workResults: WorkResult[] = [];
  const reviewResults: ReviewResult[] = [];
  const fixResults: FixResult[] = [];
  return {
    stateChanges,
    workResults,
    reviewResults,
    fixResults,
    onStateChange(from, to) { stateChanges.push({ from, to }); },
    onWorkComplete(result) { workResults.push(result); },
    onReviewComplete(result) { reviewResults.push(result); },
    onFixComplete(result) { fixResults.push(result); },
  };
}

function makeRunParams(overrides: Partial<WRFCRunParams> = {}): WRFCRunParams {
  return {
    workId: 'work-test',
    sessionId: 'sess-test',
    task: 'Write some code',
    spawner: makeSpawner(),
    reviewer: makeReviewer(),
    fixer: makeFixer(),
    callbacks: makeCallbacks(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('WRFCOrchestrator', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // -------------------------------------------------------------------------
  // 1. Happy path
  // -------------------------------------------------------------------------

  describe('happy path — review passes on first attempt', () => {
    it('returns a WRFCContext in state complete', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(makeRunParams());
      expect(ctx.state).toBe('complete');
    });

    it('populates workId, sessionId, task on the returned context', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({ workId: 'w-1', sessionId: 's-1', task: 'Do the thing' }),
      );
      expect(ctx.workId).toBe('w-1');
      expect(ctx.sessionId).toBe('s-1');
      expect(ctx.task).toBe('Do the thing');
    });

    it('sets finishedAt on the returned context', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const before = Date.now();
      const ctx = await orchestrator.run(makeRunParams());
      expect(ctx.finishedAt).toBeDefined();
      expect(ctx.finishedAt!).toBeGreaterThanOrEqual(before);
    });

    it('does not set cancelledAt when completed normally', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(makeRunParams());
      expect(ctx.cancelledAt).toBeUndefined();
    });

    it('accumulates filesModified from the work phase', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({ spawner: makeSpawner({ filesModified: ['src/a.ts', 'src/b.ts'] }) }),
      );
      expect(ctx.filesModified).toContain('src/a.ts');
      expect(ctx.filesModified).toContain('src/b.ts');
    });

    it('fires onWorkComplete once and onReviewComplete once', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const callbacks = makeCallbacks();
      await orchestrator.run(makeRunParams({ callbacks }));
      expect(callbacks.workResults).toHaveLength(1);
      expect(callbacks.reviewResults).toHaveLength(1);
      expect(callbacks.fixResults).toHaveLength(0);
    });

    it('sets lastScore on context after review', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({ reviewer: makeReviewer({ score: 9.5 }) }),
      );
      expect(ctx.lastScore).toBeDefined();
      expect(ctx.lastScore!.overall).toBe(9.5);
      expect(ctx.lastScore!.passed).toBe(true);
    });

    it('lastScore.dimensions reflects what the reviewer returned', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({ reviewer: makeReviewer({ score: 9.5 }) }),
      );
      expect(ctx.lastScore!.dimensions).toHaveProperty('quality');
      expect(ctx.lastScore!.dimensions['quality'].score).toBe(9.5);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Fix cycle
  // -------------------------------------------------------------------------

  describe('fix cycle — first review fails, second passes', () => {
    it('returns state complete after a fix cycle', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const callbacks = makeCallbacks();
      const ctx = await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ scoreSequence: [5.0, 9.5] }),
          fixer: makeFixer(),
          callbacks,
        }),
      );
      expect(ctx.state).toBe('complete');
    });

    it('calls onFixComplete exactly once during a single fix cycle', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const callbacks = makeCallbacks();
      await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ scoreSequence: [5.0, 9.5] }),
          fixer: makeFixer(),
          callbacks,
        }),
      );
      expect(callbacks.fixResults).toHaveLength(1);
    });

    it('calls reviewer at least twice during a fix cycle', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const callbacks = makeCallbacks();
      await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ scoreSequence: [5.0, 9.5] }),
          fixer: makeFixer(),
          callbacks,
        }),
      );
      expect(callbacks.reviewResults.length).toBeGreaterThanOrEqual(2);
    });

    it('accumulates filesModified from both work and fix phases', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({
          spawner: makeSpawner({ filesModified: ['src/work.ts'] }),
          reviewer: makeReviewer({ scoreSequence: [5.0, 9.5] }),
          fixer: makeFixer({ filesModified: ['src/fix.ts'] }),
        }),
      );
      expect(ctx.filesModified).toContain('src/work.ts');
      expect(ctx.filesModified).toContain('src/fix.ts');
    });

    it('deduplicate filesModified (same file listed only once)', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({
          spawner: makeSpawner({ filesModified: ['src/shared.ts'] }),
          reviewer: makeReviewer({ scoreSequence: [5.0, 9.5] }),
          fixer: makeFixer({ filesModified: ['src/shared.ts'] }),
        }),
      );
      const count = ctx.filesModified.filter((f) => f === 'src/shared.ts').length;
      expect(count).toBe(1);
    });

    it('lastScore.overall reflects score from the passing review', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ scoreSequence: [5.0, 9.5] }),
          fixer: makeFixer(),
        }),
      );
      expect(ctx.lastScore!.overall).toBe(9.5);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Max attempts — escalation
  // -------------------------------------------------------------------------

  describe('max attempts — escalation after exhausted fix budget', () => {
    it('returns state escalated when review always fails', async () => {
      const config: WRFCConfig = { ...DEFAULT_CONFIG, maxAttempts: 2 };
      const orchestrator = new WRFCOrchestrator(config, bus);
      const ctx = await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ score: 3.0 }),
          fixer: makeFixer(),
        }),
      );
      expect(ctx.state).toBe('escalated');
    });

    it('does not enter complete when maxAttempts is 1 and review fails', async () => {
      const config: WRFCConfig = { ...DEFAULT_CONFIG, maxAttempts: 1 };
      const orchestrator = new WRFCOrchestrator(config, bus);
      const ctx = await orchestrator.run(
        makeRunParams({ reviewer: makeReviewer({ score: 2.0 }) }),
      );
      expect(ctx.state).not.toBe('complete');
    });

    it('calls reviewer at least maxAttempts times when always failing', async () => {
      const config: WRFCConfig = { ...DEFAULT_CONFIG, maxAttempts: 2 };
      const orchestrator = new WRFCOrchestrator(config, bus);
      const callbacks = makeCallbacks();
      await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ score: 3.0 }),
          callbacks,
        }),
      );
      expect(callbacks.reviewResults.length).toBeGreaterThanOrEqual(config.maxAttempts);
    });

    it('sets finishedAt even when escalated', async () => {
      const config: WRFCConfig = { ...DEFAULT_CONFIG, maxAttempts: 1 };
      const orchestrator = new WRFCOrchestrator(config, bus);
      const before = Date.now();
      const ctx = await orchestrator.run(
        makeRunParams({ reviewer: makeReviewer({ score: 2.0 }) }),
      );
      expect(ctx.finishedAt).toBeDefined();
      expect(ctx.finishedAt!).toBeGreaterThanOrEqual(before);
    });

    it('lastScore is defined and below threshold on escalation', async () => {
      const config: WRFCConfig = { ...DEFAULT_CONFIG, maxAttempts: 1 };
      const orchestrator = new WRFCOrchestrator(config, bus);
      const ctx = await orchestrator.run(
        makeRunParams({ reviewer: makeReviewer({ score: 2.0 }) }),
      );
      expect(ctx.lastScore).toBeDefined();
      expect(ctx.lastScore!.overall).toBeLessThan(config.minReviewScore);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Cancellation via AbortSignal
  // -------------------------------------------------------------------------

  describe('cancellation via AbortSignal', () => {
    it('returns a non-complete state when signal is already aborted before run', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const controller = new AbortController();
      controller.abort();
      const ctx = await orchestrator.run(
        makeRunParams({ signal: controller.signal }),
      );
      expect(ctx.state).not.toBe('complete');
    });

    it('sets cancelledAt when aborted', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const controller = new AbortController();
      controller.abort();
      const before = Date.now();
      const ctx = await orchestrator.run(
        makeRunParams({ signal: controller.signal }),
      );
      expect(ctx.cancelledAt).toBeDefined();
      expect(ctx.cancelledAt!).toBeGreaterThanOrEqual(before);
    });

    it('emits wrfc:cancelled event when aborted', async () => {
      const events: string[] = [];
      bus.on('wrfc:cancelled', (ev) => events.push(ev.type));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const controller = new AbortController();
      controller.abort();
      await orchestrator.run(
        makeRunParams({ signal: controller.signal }),
      );
      expect(events).toContain('wrfc:cancelled');
    });

    it('still sets finishedAt even when cancelled', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const controller = new AbortController();
      controller.abort();
      const ctx = await orchestrator.run(
        makeRunParams({ signal: controller.signal }),
      );
      expect(ctx.finishedAt).toBeDefined();
    });

    it('does not throw when signal is aborted — resolves with context', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const controller = new AbortController();
      controller.abort();
      const result = orchestrator.run(makeRunParams({ signal: controller.signal }));
      await expect(result).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 5. State transitions
  // -------------------------------------------------------------------------

  describe('state transitions', () => {
    it('fires onStateChange for each transition during a happy-path run', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const callbacks = makeCallbacks();
      await orchestrator.run(makeRunParams({ callbacks }));
      // Expect at minimum: idle→working, working→reviewing, reviewing→complete
      expect(callbacks.stateChanges.length).toBeGreaterThanOrEqual(3);
    });

    it('first stateChange is from idle to working', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const callbacks = makeCallbacks();
      await orchestrator.run(makeRunParams({ callbacks }));
      expect(callbacks.stateChanges[0]).toEqual({ from: 'idle', to: 'working' });
    });

    it('last stateChange target is complete for a passing run', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const callbacks = makeCallbacks();
      await orchestrator.run(makeRunParams({ callbacks }));
      const last = callbacks.stateChanges[callbacks.stateChanges.length - 1];
      expect(last.to).toBe('complete');
    });

    it('stateChanges include working → reviewing transition', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const callbacks = makeCallbacks();
      await orchestrator.run(makeRunParams({ callbacks }));
      const found = callbacks.stateChanges.find(
        (c) => c.from === 'working' && c.to === 'reviewing',
      );
      expect(found).toBeDefined();
    });

    it('stateChanges include reviewing → fixing → checking for a fix cycle', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const callbacks = makeCallbacks();
      await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ scoreSequence: [5.0, 9.5] }),
          fixer: makeFixer(),
          callbacks,
        }),
      );
      const toFixing = callbacks.stateChanges.find(
        (c) => c.from === 'reviewing' && c.to === 'fixing',
      );
      const toChecking = callbacks.stateChanges.find(
        (c) => c.from === 'fixing' && c.to === 'checking',
      );
      expect(toFixing).toBeDefined();
      expect(toChecking).toBeDefined();
    });

    it('callbacks fire in order: state → work → state → review for happy path', async () => {
      const order: string[] = [];
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(
        makeRunParams({
          callbacks: {
            onStateChange: (_f, to) => order.push(`state:${to}`),
            onWorkComplete: () => order.push('work'),
            onReviewComplete: () => order.push('review'),
            onFixComplete: () => order.push('fix'),
          },
        }),
      );
      const workIdx = order.indexOf('work');
      const reviewIdx = order.indexOf('review');
      expect(workIdx).toBeGreaterThanOrEqual(0);
      expect(reviewIdx).toBeGreaterThan(workIdx);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Event emissions on EventBus
  // -------------------------------------------------------------------------

  describe('event bus emissions', () => {
    it('emits wrfc:state-changed for each transition', async () => {
      const emitted: unknown[] = [];
      bus.on('wrfc:state-changed', (ev) => emitted.push(ev.payload));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(makeRunParams());
      expect(emitted.length).toBeGreaterThanOrEqual(3);
    });

    it('wrfc:state-changed payload includes workId, sessionId, from, to', async () => {
      const payloads: unknown[] = [];
      bus.on('wrfc:state-changed', (ev) => payloads.push(ev.payload));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(
        makeRunParams({ workId: 'ev-w', sessionId: 'ev-s' }),
      );
      const first = payloads[0] as Record<string, unknown>;
      expect(first).toHaveProperty('workId', 'ev-w');
      expect(first).toHaveProperty('sessionId', 'ev-s');
      expect(first).toHaveProperty('from');
      expect(first).toHaveProperty('to');
    });

    it('emits wrfc:work-complete after work phase', async () => {
      const emitted: unknown[] = [];
      bus.on('wrfc:work-complete', (ev) => emitted.push(ev.payload));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(makeRunParams());
      expect(emitted).toHaveLength(1);
    });

    it('wrfc:work-complete payload includes filesModified', async () => {
      const payloads: unknown[] = [];
      bus.on('wrfc:work-complete', (ev) => payloads.push(ev.payload));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(
        makeRunParams({ spawner: makeSpawner({ filesModified: ['src/target.ts'] }) }),
      );
      const payload = payloads[0] as Record<string, unknown>;
      expect(payload).toHaveProperty('filesModified');
      expect(Array.isArray(payload.filesModified)).toBe(true);
    });

    it('emits wrfc:review-complete after each review', async () => {
      const emitted: unknown[] = [];
      bus.on('wrfc:review-complete', (ev) => emitted.push(ev.payload));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(makeRunParams());
      expect(emitted).toHaveLength(1);
    });

    it('wrfc:review-complete payload includes score and passed flag', async () => {
      const payloads: unknown[] = [];
      bus.on('wrfc:review-complete', (ev) => payloads.push(ev.payload));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(
        makeRunParams({ reviewer: makeReviewer({ score: 9.5 }) }),
      );
      const payload = payloads[0] as Record<string, unknown>;
      expect(payload).toHaveProperty('score', 9.5);
      expect(payload).toHaveProperty('passed', true);
    });

    it('emits wrfc:fix-complete after each fix attempt', async () => {
      const emitted: unknown[] = [];
      bus.on('wrfc:fix-complete', (ev) => emitted.push(ev.payload));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ scoreSequence: [5.0, 9.5] }),
          fixer: makeFixer(),
        }),
      );
      expect(emitted).toHaveLength(1);
    });

    it('emits wrfc:chain-complete at the very end of a run', async () => {
      const emitted: unknown[] = [];
      bus.on('wrfc:chain-complete', (ev) => emitted.push(ev.payload));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(makeRunParams());
      expect(emitted).toHaveLength(1);
    });

    it('wrfc:chain-complete payload includes finalState and score', async () => {
      const payloads: unknown[] = [];
      bus.on('wrfc:chain-complete', (ev) => payloads.push(ev.payload));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(
        makeRunParams({ reviewer: makeReviewer({ score: 9.5 }) }),
      );
      const payload = payloads[0] as Record<string, unknown>;
      expect(payload).toHaveProperty('finalState', 'complete');
      expect(payload).toHaveProperty('score', 9.5);
    });

    it('emits wrfc:chain-complete even when escalated', async () => {
      const emitted: unknown[] = [];
      bus.on('wrfc:chain-complete', (ev) => emitted.push(ev.payload));
      const config: WRFCConfig = { ...DEFAULT_CONFIG, maxAttempts: 1 };
      const orchestrator = new WRFCOrchestrator(config, bus);
      await orchestrator.run(
        makeRunParams({ reviewer: makeReviewer({ score: 2.0 }) }),
      );
      expect(emitted).toHaveLength(1);
      const payload = emitted[0] as Record<string, unknown>;
      expect(payload).toHaveProperty('finalState', 'escalated');
    });

    it('all emitted wrfc:* events during happy path contain workId and sessionId', async () => {
      const payloads: Array<Record<string, unknown>> = [];
      bus.on('wrfc:*', (ev) => payloads.push(ev.payload as Record<string, unknown>));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(
        makeRunParams({ workId: 'all-w', sessionId: 'all-s' }),
      );
      for (const payload of payloads) {
        expect(payload).toHaveProperty('workId', 'all-w');
        expect(payload).toHaveProperty('sessionId', 'all-s');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 7. Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('does not throw when reviewer throws — resolves with failed context', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const result = orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ throwError: new Error('reviewer exploded') }),
        }),
      );
      await expect(result).resolves.toBeDefined();
    });

    it('returns failed state when reviewer throws', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ throwError: new Error('boom') }),
        }),
      );
      expect(ctx.state).toBe('failed');
    });

    it('still sets finishedAt when reviewer throws', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ throwError: new Error('boom') }),
        }),
      );
      expect(ctx.finishedAt).toBeDefined();
    });

    it('emits wrfc:chain-complete even when reviewer throws', async () => {
      const emitted: unknown[] = [];
      bus.on('wrfc:chain-complete', (ev) => emitted.push(ev.payload));
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ throwError: new Error('boom') }),
        }),
      );
      expect(emitted).toHaveLength(1);
    });

    it('does not throw when spawner throws — resolves with failed context', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const result = orchestrator.run(
        makeRunParams({
          spawner: makeSpawner({ rejectWith: new Error('spawn failed') }),
        }),
      );
      await expect(result).resolves.toBeDefined();
    });

    it('returns failed state when spawner.spawn throws', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({
          spawner: makeSpawner({ rejectWith: new Error('no agents available') }),
        }),
      );
      expect(ctx.state).toBe('failed');
    });
  });

  // -------------------------------------------------------------------------
  // 8. Score tracking
  // -------------------------------------------------------------------------

  describe('score tracking', () => {
    it('getContext() is undefined before run() is called', () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      expect(orchestrator.getContext()).toBeUndefined();
    });

    it('getContext() returns final context after run() completes', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(makeRunParams({ workId: 'ctx-w' }));
      const stored = orchestrator.getContext();
      expect(stored).toBeDefined();
      expect(stored!.workId).toBe(ctx.workId);
    });

    it('lastScore is undefined before any review occurs', () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      // Pre-run: context not yet set
      expect(orchestrator.getContext()).toBeUndefined();
    });

    it('lastScore reflects final review score after run', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({ reviewer: makeReviewer({ score: 9.8 }) }),
      );
      expect(ctx.lastScore!.overall).toBe(9.8);
    });

    it('lastScore.overall tracks the most recent review score across multiple reviews', async () => {
      // Reviewer returns 5.0 then 9.7 — final score should be 9.7
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      const ctx = await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ scoreSequence: [5.0, 9.7] }),
          fixer: makeFixer(),
        }),
      );
      expect(ctx.lastScore!.overall).toBe(9.7);
    });

    it('attempt.attemptNumber is incremented for each reviewing-state pass', async () => {
      // 3 review phases: reviewing(5.0) → fix → checking(5.0) → reviewing(9.5)
      // attemptNumber increments only in 'reviewing' state (not 'checking'), so ends at 2
      const config: WRFCConfig = { ...DEFAULT_CONFIG, maxAttempts: 3 };
      const orchestrator = new WRFCOrchestrator(config, bus);
      const ctx = await orchestrator.run(
        makeRunParams({
          reviewer: makeReviewer({ scoreSequence: [5.0, 5.0, 9.5] }),
          fixer: makeFixer(),
        }),
      );
      expect(ctx.attempt.attemptNumber).toBeGreaterThanOrEqual(2);
    });

    it('orchestrator can be reused: second run returns a fresh context', async () => {
      const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
      await orchestrator.run(makeRunParams({ workId: 'first', sessionId: 's-first' }));
      const ctx2 = await orchestrator.run(makeRunParams({ workId: 'second', sessionId: 's-second' }));
      expect(ctx2.workId).toBe('second');
      expect(ctx2.state).toBe('complete');
    });
  });
});
