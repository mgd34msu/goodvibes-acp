import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import { createWRFCMachine, WRFC_EVENTS, WRFC_TERMINAL_STATES } from '../../src/extensions/wrfc/machine.js';
import { WRFCOrchestrator } from '../../src/extensions/wrfc/orchestrator.js';
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
import type { WRFCCallbacks } from '../../src/extensions/wrfc/orchestrator.js';

// ---------------------------------------------------------------------------
// Default test config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: WRFCConfig = {
  minReviewScore: 9.0,
  maxAttempts: 3,
  enableQualityGates: true,
};

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

function makeSpawner(output = 'task output'): IAgentSpawner {
  const handle: AgentHandle = { id: 'mock-agent-1', type: 'engineer', spawnedAt: Date.now() };
  return {
    async spawn(_config: AgentConfig): Promise<AgentHandle> {
      return handle;
    },
    async result(_handle: AgentHandle): Promise<AgentResult> {
      return {
        handle,
        status: 'completed',
        output,
        filesModified: ['src/index.ts'],
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

function makePassingReviewer(score = 9.5): IReviewer {
  return {
    id: 'mock-reviewer',
    capabilities: ['typescript'],
    async review(workResult: WorkResult): Promise<ReviewResult> {
      return {
        sessionId: workResult.sessionId,
        score,
        dimensions: {
          quality: { score, weight: 1.0, issues: [] },
        },
        passed: score >= 9.0,
        issues: [],
      };
    },
  };
}

function makeFailingReviewer(score = 5.0): IReviewer {
  return {
    id: 'mock-reviewer-fail',
    capabilities: ['typescript'],
    async review(workResult: WorkResult): Promise<ReviewResult> {
      return {
        sessionId: workResult.sessionId,
        score,
        dimensions: {
          quality: { score, weight: 1.0, issues: ['missing tests'] },
        },
        passed: false,
        issues: ['missing tests'],
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
        filesModified: ['src/index.ts'],
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
    onStateChange(from, to) {
      stateChanges.push({ from, to });
    },
    onWorkComplete(result) {
      workResults.push(result);
    },
    onReviewComplete(result) {
      reviewResults.push(result);
    },
    onFixComplete(result) {
      fixResults.push(result);
    },
  };
}

// ---------------------------------------------------------------------------
// createWRFCMachine tests
// ---------------------------------------------------------------------------

describe('createWRFCMachine', () => {
  it('creates a machine with initial state idle', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    expect(machine.current()).toBe('idle');
  });

  it('transitions idle → working on START event', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    machine.transition(WRFC_EVENTS.START);
    expect(machine.current()).toBe('working');
  });

  it('transitions working → reviewing on WORK_DONE', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    machine.transition(WRFC_EVENTS.START);
    machine.transition(WRFC_EVENTS.WORK_DONE);
    expect(machine.current()).toBe('reviewing');
  });

  it('transitions working → failed on WORK_FAILED', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    machine.transition(WRFC_EVENTS.START);
    machine.transition(WRFC_EVENTS.WORK_FAILED);
    expect(machine.current()).toBe('failed');
  });

  it('transitions reviewing → complete on REVIEWED_PASS when score meets threshold', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    machine.updateContext((ctx) => ({
      ...ctx,
      lastScore: { overall: 9.5, dimensions: {}, passed: true },
      attempt: { attemptNumber: 1, maxAttempts: 3, phase: 'reviewing' },
    }));
    machine.transition(WRFC_EVENTS.START);
    machine.transition(WRFC_EVENTS.WORK_DONE);
    machine.transition(WRFC_EVENTS.REVIEWED_PASS);
    expect(machine.current()).toBe('complete');
  });

  it('transitions reviewing → fixing on REVIEWED_FIX when score below threshold and attempts remain', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    machine.updateContext((ctx) => ({
      ...ctx,
      lastScore: { overall: 5.0, dimensions: {}, passed: false },
      attempt: { attemptNumber: 1, maxAttempts: 3, phase: 'reviewing' },
    }));
    machine.transition(WRFC_EVENTS.START);
    machine.transition(WRFC_EVENTS.WORK_DONE);
    machine.transition(WRFC_EVENTS.REVIEWED_FIX);
    expect(machine.current()).toBe('fixing');
  });

  it('transitions reviewing → escalated on REVIEWED_ESCALATE when attempts exhausted', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    machine.updateContext((ctx) => ({
      ...ctx,
      lastScore: { overall: 5.0, dimensions: {}, passed: false },
      attempt: { attemptNumber: 3, maxAttempts: 3, phase: 'reviewing' },
    }));
    machine.transition(WRFC_EVENTS.START);
    machine.transition(WRFC_EVENTS.WORK_DONE);
    machine.transition(WRFC_EVENTS.REVIEWED_ESCALATE);
    expect(machine.current()).toBe('escalated');
  });

  it('transitions fixing → checking on FIX_DONE', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    machine.updateContext((ctx) => ({
      ...ctx,
      lastScore: { overall: 5.0, dimensions: {}, passed: false },
      attempt: { attemptNumber: 1, maxAttempts: 3, phase: 'reviewing' },
    }));
    machine.transition(WRFC_EVENTS.START);
    machine.transition(WRFC_EVENTS.WORK_DONE);
    machine.transition(WRFC_EVENTS.REVIEWED_FIX);
    machine.transition(WRFC_EVENTS.FIX_DONE);
    expect(machine.current()).toBe('checking');
  });

  it('transitions fixing → failed on FIX_FAILED', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    machine.updateContext((ctx) => ({
      ...ctx,
      lastScore: { overall: 5.0, dimensions: {}, passed: false },
      attempt: { attemptNumber: 1, maxAttempts: 3, phase: 'reviewing' },
    }));
    machine.transition(WRFC_EVENTS.START);
    machine.transition(WRFC_EVENTS.WORK_DONE);
    machine.transition(WRFC_EVENTS.REVIEWED_FIX);
    machine.transition(WRFC_EVENTS.FIX_FAILED);
    expect(machine.current()).toBe('failed');
  });

  it('transitions checking → complete on CHECK_PASS when score meets threshold', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    // Set up context for guards
    machine.updateContext((ctx) => ({
      ...ctx,
      lastScore: { overall: 9.5, dimensions: {}, passed: true },
      attempt: { attemptNumber: 1, maxAttempts: 3, phase: 'checking' },
    }));
    machine.transition(WRFC_EVENTS.START);
    machine.transition(WRFC_EVENTS.WORK_DONE);
    // Force to checking by temporarily lowering score for the fix step
    machine.updateContext((ctx) => ({ ...ctx, lastScore: { overall: 5.0, dimensions: {}, passed: false } }));
    machine.transition(WRFC_EVENTS.REVIEWED_FIX);
    machine.transition(WRFC_EVENTS.FIX_DONE);
    // Now raise score for passing
    machine.updateContext((ctx) => ({ ...ctx, lastScore: { overall: 9.5, dimensions: {}, passed: true } }));
    machine.transition(WRFC_EVENTS.CHECK_PASS);
    expect(machine.current()).toBe('complete');
  });

  it('transitions from any non-terminal state to failed on FAIL event', () => {
    for (const fromState of ['idle', 'working', 'reviewing', 'fixing', 'checking'] as const) {
      const machine = createWRFCMachine(DEFAULT_CONFIG);
      // Advance to the target state
      if (fromState !== 'idle') {
        machine.transition(WRFC_EVENTS.START);
      }
      if (fromState === 'reviewing' || fromState === 'fixing' || fromState === 'checking') {
        machine.transition(WRFC_EVENTS.WORK_DONE);
      }
      if (fromState === 'fixing' || fromState === 'checking') {
        machine.updateContext((ctx) => ({
          ...ctx,
          lastScore: { overall: 5.0, dimensions: {}, passed: false },
          attempt: { ...ctx.attempt, attemptNumber: 1 },
        }));
        machine.transition(WRFC_EVENTS.REVIEWED_FIX);
      }
      if (fromState === 'checking') {
        machine.transition(WRFC_EVENTS.FIX_DONE);
      }

      expect(machine.current()).toBe(fromState);
      machine.transition(WRFC_EVENTS.FAIL);
      expect(machine.current()).toBe('failed');
    }
  });

  it('WRFC_TERMINAL_STATES contains complete, escalated, failed', () => {
    expect(WRFC_TERMINAL_STATES.has('complete')).toBe(true);
    expect(WRFC_TERMINAL_STATES.has('escalated')).toBe(true);
    expect(WRFC_TERMINAL_STATES.has('failed')).toBe(true);
    expect(WRFC_TERMINAL_STATES.has('idle')).toBe(false);
  });

  it('machine has a skeleton context with workId and sessionId fields', () => {
    const machine = createWRFCMachine(DEFAULT_CONFIG);
    const ctx = machine.context();
    expect(ctx).toHaveProperty('workId');
    expect(ctx).toHaveProperty('sessionId');
    expect(ctx).toHaveProperty('task');
    expect(ctx).toHaveProperty('attempt');
    expect(ctx.attempt.maxAttempts).toBe(DEFAULT_CONFIG.maxAttempts);
  });
});

// ---------------------------------------------------------------------------
// WRFCOrchestrator tests
// ---------------------------------------------------------------------------

describe('WRFCOrchestrator', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('completes a full cycle when reviewer passes', async () => {
    const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'work-1',
      sessionId: 'sess-1',
      task: 'Write a function',
      spawner: makeSpawner(),
      reviewer: makePassingReviewer(9.5),
      fixer: makeFixer(),
      callbacks,
    });

    expect(ctx.state).toBe('complete');
    expect(ctx.workId).toBe('work-1');
    expect(ctx.sessionId).toBe('sess-1');
    expect(ctx.finishedAt).toBeDefined();
    expect(callbacks.workResults).toHaveLength(1);
    expect(callbacks.reviewResults).toHaveLength(1);
    expect(callbacks.fixResults).toHaveLength(0);
  });

  it('escalates after maxAttempts with failing reviewer', async () => {
    const config: WRFCConfig = { minReviewScore: 9.0, maxAttempts: 2, enableQualityGates: true };
    const orchestrator = new WRFCOrchestrator(config, bus);
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'work-2',
      sessionId: 'sess-2',
      task: 'Write code',
      spawner: makeSpawner(),
      reviewer: makeFailingReviewer(3.0),
      fixer: makeFixer(),
      callbacks,
    });

    expect(ctx.state).toBe('escalated');
    // Reviewer was called at least maxAttempts times
    expect(callbacks.reviewResults.length).toBeGreaterThanOrEqual(config.maxAttempts);
  });

  it('goes through fix cycle before completing on second review pass', async () => {
    const config: WRFCConfig = { minReviewScore: 9.0, maxAttempts: 3, enableQualityGates: true };
    let callCount = 0;

    // Fail first review, pass on second
    const reviewer: IReviewer = {
      id: 'mock',
      capabilities: [],
      async review(workResult: WorkResult): Promise<ReviewResult> {
        callCount++;
        const score = callCount === 1 ? 5.0 : 9.5;
        return {
          sessionId: workResult.sessionId,
          score,
          dimensions: { quality: { score, weight: 1, issues: callCount === 1 ? ['bad'] : [] } },
          passed: score >= 9.0,
          issues: callCount === 1 ? ['bad'] : [],
        };
      },
    };

    const orchestrator = new WRFCOrchestrator(config, bus);
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'work-3',
      sessionId: 'sess-3',
      task: 'Improve code',
      spawner: makeSpawner(),
      reviewer,
      fixer: makeFixer(),
      callbacks,
    });

    expect(ctx.state).toBe('complete');
    expect(callbacks.fixResults).toHaveLength(1);
    expect(callbacks.reviewResults.length).toBeGreaterThanOrEqual(2);
  });

  it('handles cancellation via AbortSignal', async () => {
    const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
    const callbacks = makeCallbacks();

    const controller = new AbortController();
    // Abort before run even starts
    controller.abort();

    const ctx = await orchestrator.run({
      workId: 'work-abort',
      sessionId: 'sess-abort',
      task: 'Should be aborted',
      spawner: makeSpawner(),
      reviewer: makePassingReviewer(),
      fixer: makeFixer(),
      callbacks,
      signal: controller.signal,
    });

    // Aborted runs end in failed or escalated (not complete)
    expect(['failed', 'escalated']).toContain(ctx.state);
  });

  it('emits wrfc events on the event bus during a full run', async () => {
    const eventTypes: string[] = [];
    bus.on('wrfc:*', (ev) => eventTypes.push(ev.type));

    const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
    const callbacks = makeCallbacks();

    await orchestrator.run({
      workId: 'work-events',
      sessionId: 'sess-events',
      task: 'Emit all the events',
      spawner: makeSpawner(),
      reviewer: makePassingReviewer(9.5),
      fixer: makeFixer(),
      callbacks,
    });

    expect(eventTypes).toContain('wrfc:state-changed');
    expect(eventTypes).toContain('wrfc:work-complete');
    expect(eventTypes).toContain('wrfc:review-complete');
    expect(eventTypes).toContain('wrfc:chain-complete');
  });

  it('getContext() returns undefined before run() is called', () => {
    const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
    expect(orchestrator.getContext()).toBeUndefined();
  });

  it('getContext() returns the final context after run() completes', async () => {
    const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);
    const callbacks = makeCallbacks();

    const ctx = await orchestrator.run({
      workId: 'work-ctx',
      sessionId: 'sess-ctx',
      task: 'Test context',
      spawner: makeSpawner(),
      reviewer: makePassingReviewer(),
      fixer: makeFixer(),
      callbacks,
    });

    const storedCtx = orchestrator.getContext();
    expect(storedCtx).toBeDefined();
    expect(storedCtx!.workId).toBe(ctx.workId);
  });

  it('orchestrator callbacks fire in correct order', async () => {
    const order: string[] = [];
    const orchestrator = new WRFCOrchestrator(DEFAULT_CONFIG, bus);

    const ctx = await orchestrator.run({
      workId: 'work-order',
      sessionId: 'sess-order',
      task: 'Test callback order',
      spawner: makeSpawner(),
      reviewer: makePassingReviewer(9.5),
      fixer: makeFixer(),
      callbacks: {
        onStateChange: () => order.push('state'),
        onWorkComplete: () => order.push('work'),
        onReviewComplete: () => order.push('review'),
        onFixComplete: () => order.push('fix'),
      },
    });

    // work must come before review
    const workIdx = order.indexOf('work');
    const reviewIdx = order.indexOf('review');
    expect(workIdx).toBeGreaterThanOrEqual(0);
    expect(reviewIdx).toBeGreaterThan(workIdx);
    expect(ctx.state).toBe('complete');
  });
});
