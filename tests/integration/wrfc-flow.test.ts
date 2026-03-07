/**
 * @file wrfc-flow.test.ts
 * @description Full WRFC pipeline integration tests using real L1/L2 instances.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import { Registry } from '../../src/core/registry.js';
import { StateStore } from '../../src/core/state-store.js';
import { WRFCOrchestrator } from '../../src/extensions/wrfc/orchestrator.js';
import type { WRFCConfig } from '../../src/types/wrfc.js';
import type {
  WorkResult,
  ReviewResult,
  FixResult,
  IReviewer,
  IFixer,
  IAgentSpawner,
} from '../../src/types/registry.js';
import type { AgentHandle, AgentConfig, AgentResult } from '../../src/types/agent.js';
import type { WRFCCallbacks } from '../../src/extensions/wrfc/orchestrator.js';

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

function makeSpawner(output = 'work output'): IAgentSpawner {
  const handle: AgentHandle = { id: 'agent-1', type: 'engineer', spawnedAt: Date.now() };
  return {
    async spawn(_config: AgentConfig): Promise<AgentHandle> {
      return handle;
    },
    async result(_handle: AgentHandle): Promise<AgentResult> {
      return {
        handle,
        status: 'completed',
        output,
        filesModified: ['src/feature.ts'],
        errors: [],
        durationMs: 10,
      };
    },
    async cancel(_handle: AgentHandle): Promise<void> {},
    status(_handle: AgentHandle) {
      return 'completed' as const;
    },
  };
}

function makeReviewer(score: number): IReviewer {
  return {
    id: `mock-reviewer-${score}`,
    capabilities: ['typescript'],
    async review(workResult: WorkResult): Promise<ReviewResult> {
      return {
        sessionId: workResult.sessionId,
        score,
        dimensions: {
          quality: { score, weight: 1.0, issues: score < 9.5 ? ['needs improvement'] : [] },
        },
        passed: score >= 9.5,
        issues: score < 9.5 ? ['needs improvement'] : [],
      };
    },
  };
}

function makeFixer(): IFixer {
  return {
    async fix(reviewResult: ReviewResult): Promise<FixResult> {
      return {
        sessionId: reviewResult.sessionId,
        success: true,
        filesModified: ['src/feature.ts'],
        resolvedIssues: reviewResult.issues,
        remainingIssues: [],
      };
    },
  };
}

function makeCallbacks(): WRFCCallbacks & {
  stateChanges: Array<{ from: string; to: string }>;
  workResults: WorkResult[];
  reviewResults: ReviewResult[];
  fixResults: FixResult[];
} {
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

// ---------------------------------------------------------------------------
// Integration test setup
// ---------------------------------------------------------------------------

const PASSING_CONFIG: WRFCConfig = {
  minReviewScore: 9.5,
  maxAttempts: 3,
  enableQualityGates: true,
};

let eventBus: EventBus;
let registry: Registry;
let stateStore: StateStore;

beforeEach(() => {
  eventBus = new EventBus();
  registry = new Registry();
  stateStore = new StateStore();
});

// ---------------------------------------------------------------------------
// Full WRFC pipeline: work → review → PASS
// ---------------------------------------------------------------------------

describe('WRFC integration: work → review → pass (score >= 9.5)', () => {
  test('returns complete state when reviewer passes on first review', async () => {
    const orchestrator = new WRFCOrchestrator(PASSING_CONFIG, eventBus);
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'int-work-1',
      sessionId: 'int-sess-1',
      task: 'Implement a feature',
      spawner: makeSpawner(),
      reviewer: makeReviewer(9.5),
      fixer: makeFixer(),
      callbacks,
    });

    expect(ctx.state).toBe('complete');
    expect(ctx.workId).toBe('int-work-1');
    expect(ctx.sessionId).toBe('int-sess-1');
    expect(ctx.finishedAt).toBeDefined();
  });

  test('fires exactly one work result and one review result on first-pass', async () => {
    const orchestrator = new WRFCOrchestrator(PASSING_CONFIG, eventBus);
    const callbacks = makeCallbacks();

    await orchestrator.run({
      workId: 'int-work-2',
      sessionId: 'int-sess-2',
      task: 'Pass on first try',
      spawner: makeSpawner(),
      reviewer: makeReviewer(9.5),
      fixer: makeFixer(),
      callbacks,
    });

    expect(callbacks.workResults).toHaveLength(1);
    expect(callbacks.reviewResults).toHaveLength(1);
    expect(callbacks.fixResults).toHaveLength(0);
  });

  test('emits wrfc:chain-complete event with complete finalState', async () => {
    const emittedEvents: string[] = [];
    eventBus.on('wrfc:*', (ev) => emittedEvents.push(ev.type));

    const orchestrator = new WRFCOrchestrator(PASSING_CONFIG, eventBus);
    const callbacks = makeCallbacks();

    await orchestrator.run({
      workId: 'int-work-events',
      sessionId: 'int-sess-events',
      task: 'Emit events',
      spawner: makeSpawner(),
      reviewer: makeReviewer(9.5),
      fixer: makeFixer(),
      callbacks,
    });

    expect(emittedEvents).toContain('wrfc:state-changed');
    expect(emittedEvents).toContain('wrfc:work-complete');
    expect(emittedEvents).toContain('wrfc:review-complete');
    expect(emittedEvents).toContain('wrfc:chain-complete');
  });

  test('real L1 instances (EventBus, StateStore, Registry) are wire-compatible', () => {
    // Verify L1 instances are created and functional
    expect(eventBus).toBeInstanceOf(EventBus);
    expect(registry).toBeInstanceOf(Registry);
    expect(stateStore).toBeInstanceOf(StateStore);
    // EventBus can emit and receive
    const received: unknown[] = [];
    eventBus.on('test:event', (ev) => received.push(ev));
    eventBus.emit('test:event', { type: 'test:event', payload: 42 });
    expect(received).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Full WRFC pipeline: work → review (fail) → fix → review (pass)
// ---------------------------------------------------------------------------

describe('WRFC integration: work → review (fail) → fix → review (pass)', () => {
  test('returns complete state after one fix cycle', async () => {
    let callCount = 0;
    const reviewer: IReviewer = {
      id: 'flip-reviewer',
      capabilities: ['typescript'],
      async review(workResult: WorkResult): Promise<ReviewResult> {
        callCount++;
        const score = callCount === 1 ? 4.0 : 9.5;
        return {
          sessionId: workResult.sessionId,
          score,
          dimensions: { quality: { score, weight: 1.0, issues: score < 9.5 ? ['issues'] : [] } },
          passed: score >= 9.5,
          issues: score < 9.5 ? ['issues'] : [],
        };
      },
    };

    const orchestrator = new WRFCOrchestrator(PASSING_CONFIG, eventBus);
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'int-fix-1',
      sessionId: 'int-fix-sess-1',
      task: 'Fix then pass',
      spawner: makeSpawner(),
      reviewer,
      fixer: makeFixer(),
      callbacks,
    });

    expect(ctx.state).toBe('complete');
  });

  test('fires one fix result before completing', async () => {
    let callCount = 0;
    const reviewer: IReviewer = {
      id: 'flip-reviewer-2',
      capabilities: [],
      async review(workResult: WorkResult): Promise<ReviewResult> {
        callCount++;
        const score = callCount === 1 ? 4.0 : 9.5;
        return {
          sessionId: workResult.sessionId,
          score,
          dimensions: { quality: { score, weight: 1.0, issues: score < 9.5 ? ['bad'] : [] } },
          passed: score >= 9.5,
          issues: score < 9.5 ? ['bad'] : [],
        };
      },
    };

    const orchestrator = new WRFCOrchestrator(PASSING_CONFIG, eventBus);
    const callbacks = makeCallbacks();

    await orchestrator.run({
      workId: 'int-fix-2',
      sessionId: 'int-fix-sess-2',
      task: 'Fix cycle',
      spawner: makeSpawner(),
      reviewer,
      fixer: makeFixer(),
      callbacks,
    });

    expect(callbacks.fixResults).toHaveLength(1);
    expect(callbacks.reviewResults.length).toBeGreaterThanOrEqual(2);
  });

  test('review result sessionId matches run sessionId', async () => {
    let callCount = 0;
    const reviewer: IReviewer = {
      id: 'session-check-reviewer',
      capabilities: [],
      async review(workResult: WorkResult): Promise<ReviewResult> {
        callCount++;
        const score = callCount === 1 ? 4.0 : 9.5;
        return {
          sessionId: workResult.sessionId,
          score,
          dimensions: { quality: { score, weight: 1.0, issues: [] } },
          passed: score >= 9.5,
          issues: [],
        };
      },
    };

    const orchestrator = new WRFCOrchestrator(PASSING_CONFIG, eventBus);
    const callbacks = makeCallbacks();

    await orchestrator.run({
      workId: 'int-sess-check',
      sessionId: 'the-session-id',
      task: 'Check session',
      spawner: makeSpawner(),
      reviewer,
      fixer: makeFixer(),
      callbacks,
    });

    for (const result of callbacks.reviewResults) {
      expect(result.sessionId).toBe('the-session-id');
    }
  });
});

// ---------------------------------------------------------------------------
// Full WRFC pipeline: escalation (max attempts exhausted)
// ---------------------------------------------------------------------------

describe('WRFC integration: escalation after maxAttempts', () => {
  test('escalates when reviewer always fails with maxAttempts=1', async () => {
    const config: WRFCConfig = { minReviewScore: 9.5, maxAttempts: 1, enableQualityGates: true };
    const orchestrator = new WRFCOrchestrator(config, eventBus);
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'int-escalate-1',
      sessionId: 'int-esc-sess-1',
      task: 'Always fail',
      spawner: makeSpawner(),
      reviewer: makeReviewer(2.0),
      fixer: makeFixer(),
      callbacks,
    });

    expect(ctx.state).toBe('escalated');
  });

  test('escalates after 3 review fails with maxAttempts=3', async () => {
    const config: WRFCConfig = { minReviewScore: 9.5, maxAttempts: 3, enableQualityGates: true };
    const orchestrator = new WRFCOrchestrator(config, eventBus);
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'int-escalate-3',
      sessionId: 'int-esc-sess-3',
      task: 'Always fail 3x',
      spawner: makeSpawner(),
      reviewer: makeReviewer(1.0),
      fixer: makeFixer(),
      callbacks,
    });

    expect(ctx.state).toBe('escalated');
    // Reviewer called at least maxAttempts times
    expect(callbacks.reviewResults.length).toBeGreaterThanOrEqual(config.maxAttempts);
  });

  test('work → review (fail) → fix → review (fail) → fix → review (fail) → escalate', async () => {
    const config: WRFCConfig = { minReviewScore: 9.5, maxAttempts: 3, enableQualityGates: true };
    // Always return a failing score
    const reviewer = makeReviewer(3.0);
    const orchestrator = new WRFCOrchestrator(config, eventBus);
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'int-full-escalate',
      sessionId: 'int-full-esc-sess',
      task: 'Full escalation flow',
      spawner: makeSpawner(),
      reviewer,
      fixer: makeFixer(),
      callbacks,
    });

    expect(ctx.state).toBe('escalated');
    // Fix was applied 2 times (between attempt 1→2, 2→3)
    expect(callbacks.fixResults.length).toBeGreaterThanOrEqual(2);
  });

  test('finishedAt is set even on escalation', async () => {
    const config: WRFCConfig = { minReviewScore: 9.5, maxAttempts: 1, enableQualityGates: true };
    const orchestrator = new WRFCOrchestrator(config, eventBus);
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'int-fin-check',
      sessionId: 'int-fin-sess',
      task: 'Check finishedAt',
      spawner: makeSpawner(),
      reviewer: makeReviewer(2.0),
      fixer: makeFixer(),
      callbacks,
    });

    expect(ctx.finishedAt).toBeDefined();
    expect(ctx.finishedAt).toBeGreaterThan(0);
  });
});
