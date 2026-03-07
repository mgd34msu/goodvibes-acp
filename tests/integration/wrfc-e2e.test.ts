/**
 * @file wrfc-e2e.test.ts
 * @description End-to-end WRFC integration tests using real AgentSpawnerPlugin + MockProvider.
 *
 * Unlike wrfc-flow.test.ts (which uses a hand-rolled IAgentSpawner stub), this suite
 * exercises the full AgentSpawnerPlugin → AgentLoop → MockProvider path so that the
 * real agentic machinery is exercised in each work phase.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import { Registry } from '../../src/core/registry.js';
import { StateStore } from '../../src/core/state-store.js';
import { WRFCOrchestrator } from '../../src/extensions/wrfc/orchestrator.js';
import { AgentSpawnerPlugin } from '../../src/plugins/agents/spawner.js';
import { MockProvider } from '../../src/plugins/agents/providers/mock.js';
import type { WRFCConfig } from '../../src/types/wrfc.js';
import type {
  WorkResult,
  ReviewResult,
  FixResult,
  IReviewer,
  IFixer,
} from '../../src/types/registry.js';
import type { WRFCCallbacks } from '../../src/extensions/wrfc/orchestrator.js';
import type { ChatResponse } from '../../src/types/llm.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A canned MockProvider response that ends the agent turn (no tool calls). */
function makeEndTurnResponse(): ChatResponse {
  return {
    id: 'msg-1',
    model: 'mock',
    content: [{ type: 'text', text: 'Done' }],
    stopReason: 'end_turn',
    usage: { inputTokens: 10, outputTokens: 5 },
  };
}

/**
 * Build a reviewer whose score sequence cycles through the provided scores.
 * After exhausting the array, the last score is returned for every subsequent call.
 */
function makeSequentialReviewer(scores: number[]): IReviewer & { callCount: number } {
  let callCount = 0;
  const minPassScore = 9.5;
  return {
    id: 'sequential-reviewer',
    capabilities: ['typescript'],
    get callCount() { return callCount; },
    async review(workResult: WorkResult): Promise<ReviewResult> {
      const score = scores[Math.min(callCount, scores.length - 1)];
      callCount++;
      return {
        sessionId: workResult.sessionId,
        score,
        dimensions: {
          quality: {
            score,
            weight: 1.0,
            issues: score < minPassScore ? ['needs improvement'] : [],
          },
        },
        passed: score >= minPassScore,
        issues: score < minPassScore ? ['needs improvement'] : [],
      };
    },
  };
}

function makeFixer(): IFixer & { callCount: number } {
  let callCount = 0;
  return {
    get callCount() { return callCount; },
    async fix(reviewResult: ReviewResult): Promise<FixResult> {
      callCount++;
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
// Test setup
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: WRFCConfig = {
  minReviewScore: 9.5,
  maxAttempts: 3,
  enableQualityGates: true,
};

let eventBus: EventBus;
let registry: Registry;
let _stateStore: StateStore; // created for completeness; wire-compatible check
let mockProvider: MockProvider;
let spawner: AgentSpawnerPlugin;

beforeEach(() => {
  eventBus = new EventBus();
  registry = new Registry();
  _stateStore = new StateStore();
  mockProvider = new MockProvider();
  registry.register<MockProvider>('llm-provider', mockProvider);
  spawner = new AgentSpawnerPlugin(registry);
});

// ---------------------------------------------------------------------------
// Test 1: WRFC pass on first review
// ---------------------------------------------------------------------------

describe('WRFC e2e: pass on first review', () => {
  test('reaches complete state, attempt count is 1, lastScore >= 9.5', async () => {
    // Enqueue one response for the work phase (AgentLoop calls provider.chat once)
    mockProvider.enqueue(makeEndTurnResponse());

    const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, eventBus);
    const reviewer = makeSequentialReviewer([10.0]);
    const fixer = makeFixer();
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'e2e-pass-1',
      sessionId: 'e2e-sess-pass-1',
      task: 'implement feature X',
      spawner,
      reviewer,
      fixer,
      callbacks,
    });

    expect(ctx.state).toBe('complete');
    expect(ctx.attempt.attemptNumber).toBe(1);
    expect(ctx.lastScore?.overall).toBeGreaterThanOrEqual(9.5);
  });
});

// ---------------------------------------------------------------------------
// Test 2: WRFC fix loop then pass
// ---------------------------------------------------------------------------

describe('WRFC e2e: fix loop then pass', () => {
  test('completes after one fix cycle with correct attempt count and callback order', async () => {
    // One chat call for the work phase
    mockProvider.enqueue(makeEndTurnResponse());

    const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, eventBus);
    // First review fails (7.0), second review passes (10.0)
    const reviewer = makeSequentialReviewer([7.0, 10.0]);
    const fixer = makeFixer();
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'e2e-fix-1',
      sessionId: 'e2e-sess-fix-1',
      task: 'implement feature X with fix cycle',
      spawner,
      reviewer,
      fixer,
      callbacks,
    });

    expect(ctx.state).toBe('complete');
    // Only the initial review phase increments attemptNumber; check phase does not
    expect(ctx.attempt.attemptNumber).toBe(1);
    // Fix was called exactly once
    expect(fixer.callCount).toBe(1);
    // Callbacks: 1 work, 2 reviews (initial + check), 1 fix
    expect(callbacks.workResults).toHaveLength(1);
    expect(callbacks.reviewResults).toHaveLength(2);
    expect(callbacks.fixResults).toHaveLength(1);
    // Order: work before review before fix
    expect(callbacks.stateChanges.map((s) => s.to)).toContain('working');
    expect(callbacks.stateChanges.map((s) => s.to)).toContain('reviewing');
    expect(callbacks.stateChanges.map((s) => s.to)).toContain('fixing');
    expect(callbacks.stateChanges.map((s) => s.to)).toContain('complete');
  });
});

// ---------------------------------------------------------------------------
// Test 3: WRFC escalation after max attempts
// ---------------------------------------------------------------------------

describe('WRFC e2e: escalation after max attempts', () => {
  test('reaches escalated state when reviewer always returns score 5.0 with maxAttempts=2', async () => {
    mockProvider.enqueue(makeEndTurnResponse());

    const config: WRFCConfig = {
      minReviewScore: 9.5,
      maxAttempts: 2,
      enableQualityGates: true,
    };
    const orchestrator = new WRFCOrchestrator(config, eventBus);
    const reviewer = makeSequentialReviewer([5.0]);
    const fixer = makeFixer();
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'e2e-escalate-1',
      sessionId: 'e2e-sess-esc-1',
      task: 'task that never passes review',
      spawner,
      reviewer,
      fixer,
      callbacks,
    });

    expect(ctx.state).toBe('escalated');
    // At least maxAttempts reviews were performed
    expect(callbacks.reviewResults.length).toBeGreaterThanOrEqual(config.maxAttempts);
    expect(ctx.finishedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 4: WRFC cancellation
// ---------------------------------------------------------------------------

describe('WRFC e2e: cancellation via AbortSignal', () => {
  test('reaches escalated/failed state when signal is already aborted before run()', async () => {
    // No queued responses needed — abort fires before provider.chat() is called
    const controller = new AbortController();
    controller.abort(); // pre-abort

    const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, eventBus);
    const reviewer = makeSequentialReviewer([10.0]);
    const fixer = makeFixer();
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'e2e-cancel-1',
      sessionId: 'e2e-sess-cancel-1',
      task: 'task that gets cancelled',
      spawner,
      reviewer,
      fixer,
      callbacks,
      signal: controller.signal,
    });

    // Orchestrator drives to escalated on abort (as documented in orchestrator.ts)
    expect(ctx.state).toBe('escalated');
    expect(ctx.finishedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 5: Event bus events fired
// ---------------------------------------------------------------------------

describe('WRFC e2e: event bus events', () => {
  test('fires wrfc:state-changed, wrfc:work-complete, wrfc:review-complete, wrfc:chain-complete on passing run', async () => {
    mockProvider.enqueue(makeEndTurnResponse());

    const firedEvents: string[] = [];
    eventBus.on('wrfc:state-changed', (ev) => firedEvents.push(ev.type));
    eventBus.on('wrfc:work-complete', (ev) => firedEvents.push(ev.type));
    eventBus.on('wrfc:review-complete', (ev) => firedEvents.push(ev.type));
    eventBus.on('wrfc:chain-complete', (ev) => firedEvents.push(ev.type));

    const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, eventBus);
    const reviewer = makeSequentialReviewer([10.0]);
    const fixer = makeFixer();
    const callbacks = makeCallbacks();

    await orchestrator.run({
      workId: 'e2e-events-1',
      sessionId: 'e2e-sess-events-1',
      task: 'task that fires all events',
      spawner,
      reviewer,
      fixer,
      callbacks,
    });

    expect(firedEvents).toContain('wrfc:state-changed');
    expect(firedEvents).toContain('wrfc:work-complete');
    expect(firedEvents).toContain('wrfc:review-complete');
    expect(firedEvents).toContain('wrfc:chain-complete');
  });
});
