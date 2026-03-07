/**
 * orchestrator.ts — WRFC chain orchestrator
 *
 * L2 Extension — imports from L0 types and L1 core only.
 * Manages the full lifecycle of a single Work→Review→Fix→Check chain.
 */

import type { WRFCState, WRFCConfig, WRFCContext, ReviewScore } from '../../types/wrfc.js';
import type {
  WorkResult,
  ReviewResult,
  FixResult,
  IReviewer,
  IFixer,
  IAgentSpawner,
} from '../../types/registry.js';
import type { AgentConfig } from '../../types/agent.js';
import { EventBus } from '../../core/event-bus.js';
import { createWRFCMachine, WRFC_EVENTS, WRFC_TERMINAL_STATES } from './machine.js';

// ---------------------------------------------------------------------------
// Orchestrator callbacks
// ---------------------------------------------------------------------------

/** Optional lifecycle callbacks for a WRFC run */
export interface WRFCCallbacks {
  /** Fired whenever the state machine transitions */
  onStateChange: (from: WRFCState, to: WRFCState, context: WRFCContext) => void;
  /** Fired when the work phase produces a result */
  onWorkComplete: (result: WorkResult) => void;
  /** Fired when a review pass produces a result */
  onReviewComplete: (result: ReviewResult) => void;
  /** Fired when a fix pass produces a result */
  onFixComplete: (result: FixResult) => void;
}

// ---------------------------------------------------------------------------
// Run parameters
// ---------------------------------------------------------------------------

/** Parameters for a single WRFCOrchestrator.run() invocation */
export interface WRFCRunParams {
  /** Unique identifier for this work unit */
  workId: string;
  /** Session this chain belongs to */
  sessionId: string;
  /** Task description passed to the engineer agent */
  task: string;
  /** Spawner used to create and await engineer agents */
  spawner: IAgentSpawner;
  /** Reviewer used to score completed work */
  reviewer: IReviewer;
  /** Fixer used to address review issues */
  fixer: IFixer;
  /** Lifecycle callbacks */
  callbacks: WRFCCallbacks;
  /** Optional cancellation signal */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function reviewResultToScore(result: ReviewResult): ReviewScore {
  return {
    overall: result.score,
    dimensions: Object.fromEntries(
      Object.entries(result.dimensions).map(([name, dim]) => [
        name,
        { name, score: dim.score, weight: dim.weight, issues: dim.issues },
      ]),
    ),
    passed: result.passed,
    notes: result.notes,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Orchestrates a single WRFC chain.
 *
 * Usage:
 * ```typescript
 * const orchestrator = new WRFCOrchestrator(config, eventBus);
 * const context = await orchestrator.run({ workId, sessionId, task, spawner, reviewer, fixer, callbacks });
 * ```
 *
 * The orchestrator is single-use per run — construct a new instance for each
 * independent work unit, or reuse by awaiting the previous run to completion.
 */
export class WRFCOrchestrator {
  private _context: WRFCContext | undefined;

  constructor(
    private readonly config: WRFCConfig,
    private readonly eventBus: EventBus,
  ) {}

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Run a full WRFC chain.
   *
   * @param params - Run parameters including task, registry interfaces, and callbacks
   * @returns Final WRFCContext when the chain reaches a terminal state
   * @throws Never — errors are captured and drive the machine to 'failed'
   */
  async run(params: WRFCRunParams): Promise<WRFCContext> {
    const { workId, sessionId, task, spawner, reviewer, fixer, callbacks, signal } = params;
    const { minReviewScore, maxAttempts } = this.config;

    // Create state machine
    const machine = createWRFCMachine(this.config);

    // Seed real context
    const initialContext: WRFCContext = {
      workId,
      sessionId,
      task,
      state: 'idle',
      attempt: {
        attemptNumber: 0,
        maxAttempts,
        phase: 'idle',
      },
      filesModified: [],
      startedAt: Date.now(),
    };
    machine.updateContext(() => initialContext);
    this._context = machine.context();

    // Wire state-change callback + event bus
    machine.onTransition((record) => {
      machine.updateContext((ctx) => ({
        ...ctx,
        state: record.to,
        attempt: { ...ctx.attempt, phase: record.to },
      }));
      this._context = machine.context();

      callbacks.onStateChange(record.from, record.to, machine.context());

      this.eventBus.emit('wrfc:state-changed', {
        workId,
        sessionId,
        from: record.from,
        to: record.to,
        attempt: machine.context().attempt.attemptNumber,
      });
    });

    // -----------------------------------------------------------------------
    // WORK phase
    // -----------------------------------------------------------------------
    try {
      this._checkAbort(signal);
      machine.transition(WRFC_EVENTS.START);

      // WRFC spec: attempt 1 = 'engineer', subsequent = 'fixer'. Currently no retry loop.
      const agentConfig: AgentConfig = {
        type: 'engineer',
        task,
        sessionId,
      };

      const handle = await spawner.spawn(agentConfig);
      this._checkAbort(signal);

      const agentResult = await spawner.result(handle);
      this._checkAbort(signal);

      const workResult: WorkResult = {
        sessionId,
        task,
        output: agentResult.output,
        filesModified: agentResult.filesModified,
        errors: agentResult.errors.map((e) => e.message ?? `Unknown error (code: ${e.code})`),
        durationMs: agentResult.durationMs,
      };

      // Accumulate modified files
      machine.updateContext((ctx) => ({
        ...ctx,
        filesModified: [...new Set([...ctx.filesModified, ...workResult.filesModified])],
      }));
      this._context = machine.context();

      machine.transition(WRFC_EVENTS.WORK_DONE);
      callbacks.onWorkComplete(workResult);

      this.eventBus.emit('wrfc:work-complete', {
        workId,
        sessionId,
        filesModified: workResult.filesModified,
      });

      // -----------------------------------------------------------------------
      // REVIEW → FIX/CHECK loop
      // -----------------------------------------------------------------------
      let lastWorkResult: WorkResult = workResult;

      while (!WRFC_TERMINAL_STATES.has(machine.current())) {
        this._checkAbort(signal);

        const isCheckPhase = machine.current() === 'checking';
        const reviewPhase = isCheckPhase ? 'checking' : 'reviewing';

        // Increment attempt counter when entering review (not check)
        if (!isCheckPhase) {
          machine.updateContext((ctx) => ({
            ...ctx,
            attempt: {
              ...ctx.attempt,
              attemptNumber: ctx.attempt.attemptNumber + 1,
              phase: reviewPhase,
            },
          }));
          this._context = machine.context();
        }

        // --- Review ---
        const reviewResult = await reviewer.review(lastWorkResult);
        this._checkAbort(signal);

        const score = reviewResultToScore(reviewResult);
        machine.updateContext((ctx) => ({ ...ctx, lastScore: score }));
        this._context = machine.context();

        callbacks.onReviewComplete(reviewResult);
        this.eventBus.emit('wrfc:review-complete', {
          workId,
          sessionId,
          score: reviewResult.score,
          passed: reviewResult.passed,
        });

        // --- Determine outcome ---
        const currentAttempt = machine.context().attempt.attemptNumber;
        const passed = score.overall >= minReviewScore;
        const attemptsExhausted = currentAttempt >= maxAttempts;

        if (passed) {
          const passEvent = isCheckPhase ? WRFC_EVENTS.CHECK_PASS : WRFC_EVENTS.REVIEWED_PASS;
          machine.transition(passEvent);
          // Terminal: complete
          break;
        } else if (attemptsExhausted) {
          const escalateEvent = isCheckPhase
            ? WRFC_EVENTS.CHECK_ESCALATE
            : WRFC_EVENTS.REVIEWED_ESCALATE;
          machine.transition(escalateEvent);
          // Terminal: escalated
          break;
        } else {
          // Fix attempt
          const fixEvent = isCheckPhase ? WRFC_EVENTS.CHECK_FIX : WRFC_EVENTS.REVIEWED_FIX;
          machine.transition(fixEvent);
          this._checkAbort(signal);

          const fixResult = await fixer.fix(reviewResult);
          this._checkAbort(signal);

          machine.updateContext((ctx) => ({
            ...ctx,
            filesModified: [...new Set([...ctx.filesModified, ...fixResult.filesModified])],
          }));
          this._context = machine.context();

          callbacks.onFixComplete(fixResult);
          this.eventBus.emit('wrfc:fix-complete', {
            workId,
            sessionId,
            resolvedIssues: fixResult.resolvedIssues,
          });

          // Synthesize a WorkResult from the fix for the next review pass
          lastWorkResult = {
            sessionId,
            task,
            output: '',
            filesModified: fixResult.filesModified,
            errors: fixResult.remainingIssues,
            durationMs: 0,
          };

          machine.transition(WRFC_EVENTS.FIX_DONE);
          // Loop back — machine is now in 'checking'
        }
      }
    } catch (err) {
      // Distinguish cancellation from failure
      const isAbort =
        (err instanceof DOMException && err.name === 'AbortError') || signal?.aborted;

      if (isAbort) {
        // Drive the machine to a terminal state via the FAIL event.
        // A dedicated CANCEL event/state is not available in the current L0 types;
        // the cancelledAt timestamp in context distinguishes this from a genuine failure.
        if (!WRFC_TERMINAL_STATES.has(machine.current())) {
          machine.transition(WRFC_EVENTS.FAIL);
        }
        machine.updateContext((ctx) => ({
          ...ctx,
          cancelledAt: Date.now(),
        }));
        this._context = machine.context();
        this.eventBus.emit('wrfc:cancelled', { workId, sessionId });
      } else {
        // Any unhandled error drives the machine to failed
        if (!WRFC_TERMINAL_STATES.has(machine.current())) {
          machine.transition(WRFC_EVENTS.FAIL);
        }
      }
      // Do not rethrow — return final context
    }

    // -----------------------------------------------------------------------
    // Finalize context
    // -----------------------------------------------------------------------
    machine.updateContext((ctx) => ({ ...ctx, finishedAt: Date.now() }));
    this._context = machine.context();

    const finalState = machine.current();
    this.eventBus.emit('wrfc:chain-complete', {
      workId,
      sessionId,
      finalState,
      score: machine.context().lastScore?.overall,
    });

    return this._context;
  }

  /**
   * Get the current WRFC context.
   * Returns undefined if run() has not been called yet.
   */
  getContext(): WRFCContext | undefined {
    return this._context;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Throw an AbortError if the signal has been aborted.
   * Called before each async boundary to support cooperative cancellation.
   */
  private _checkAbort(signal: AbortSignal | undefined): void {
    if (signal?.aborted) {
      throw new DOMException('WRFC chain aborted', 'AbortError');
    }
  }
}
