/**
 * machine.ts — WRFC state machine factory
 *
 * L2 Extension — imports from L0 types and L1 core only.
 * Configures an L1 StateMachine with WRFC-specific states and transitions.
 */

import type { WRFCState, WRFCConfig, WRFCContext } from '../../types/wrfc.js';
import { StateMachine } from '../../core/state-machine.js';
import type { StateMachineConfig } from '../../core/state-machine.js';

// ---------------------------------------------------------------------------
// WRFC events
// ---------------------------------------------------------------------------

/** Named events that drive the WRFC state machine */
export const WRFC_EVENTS = {
  /** Begin work from idle */
  START: 'start',
  /** Work phase completed successfully */
  WORK_DONE: 'work-done',
  /** Work phase encountered a fatal error */
  WORK_FAILED: 'work-failed',
  /** Review passed the minimum score threshold */
  REVIEWED_PASS: 'reviewed-pass',
  /** Review failed; fix attempt within budget */
  REVIEWED_FIX: 'reviewed-fix',
  /** Review failed; attempts exhausted — escalate */
  REVIEWED_ESCALATE: 'reviewed-escalate',
  /** Fix applied successfully */
  FIX_DONE: 'fix-done',
  /** Fix encountered a fatal error */
  FIX_FAILED: 'fix-failed',
  /** Check (post-fix review) passed */
  CHECK_PASS: 'check-pass',
  /** Check failed; fix attempt within budget */
  CHECK_FIX: 'check-fix',
  /** Check failed; attempts exhausted — escalate */
  CHECK_ESCALATE: 'check-escalate',
  /** Force transition to failed from any non-terminal state */
  FAIL: 'fail',
  /** Cancel the chain — user-initiated abort */
  CANCEL: 'cancel',
} as const;

export type WRFCEvent = (typeof WRFC_EVENTS)[keyof typeof WRFC_EVENTS];

// ---------------------------------------------------------------------------
// Terminal states — no further transitions allowed
// ---------------------------------------------------------------------------

export const WRFC_TERMINAL_STATES: ReadonlySet<WRFCState> = new Set<WRFCState>([
  'complete',
  'escalated',
  'failed',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// Machine factory
// ---------------------------------------------------------------------------

/**
 * Create a configured WRFC state machine.
 *
 * The returned machine's context starts as a skeleton — the orchestrator
 * populates it immediately after construction via updateContext().
 *
 * Guards are evaluated at transition time and close over the current context
 * via the StateMachine's guard callback signature.
 *
 * @param config - WRFC configuration (minReviewScore, maxAttempts, …)
 * @returns Configured StateMachine ready for use by WRFCOrchestrator
 *
 * @internal — This machine is designed to be driven only by WRFCOrchestrator.
 * Guards are a safety net, not primary control flow. Do not drive transitions directly.
 */
export function createWRFCMachine(
  config: WRFCConfig,
): StateMachine<WRFCState, WRFCContext> {
  const { minReviewScore, maxAttempts } = config;

  const machineConfig: StateMachineConfig<WRFCState, WRFCContext> = {
    initial: 'idle',

    // State hooks are intentionally empty here; the orchestrator registers
    // its own onTransition listener to drive side effects.
    states: {
      idle: {},
      working: {},
      reviewing: {},
      fixing: {},
      checking: {},
      complete: {},
      escalated: {},
      failed: {},
      cancelled: {},
    },

    transitions: [
      // -----------------------------------------------------------------------
      // Work phase
      // -----------------------------------------------------------------------
      {
        from: 'idle',
        to: 'working',
        event: WRFC_EVENTS.START,
      },
      {
        from: 'working',
        to: 'reviewing',
        event: WRFC_EVENTS.WORK_DONE,
      },
      {
        from: 'working',
        to: 'failed',
        event: WRFC_EVENTS.WORK_FAILED,
      },

      // -----------------------------------------------------------------------
      // Review phase — three possible outcomes
      // -----------------------------------------------------------------------
      {
        from: 'reviewing',
        to: 'complete',
        event: WRFC_EVENTS.REVIEWED_PASS,
        guard: (ctx) =>
          ctx.lastScore !== undefined && ctx.lastScore.overall >= minReviewScore,
      },
      {
        from: 'reviewing',
        to: 'fixing',
        event: WRFC_EVENTS.REVIEWED_FIX,
        guard: (ctx) =>
          (ctx.lastScore === undefined || ctx.lastScore.overall < minReviewScore) &&
          ctx.attempt.attemptNumber < maxAttempts,
      },
      {
        from: 'reviewing',
        to: 'escalated',
        event: WRFC_EVENTS.REVIEWED_ESCALATE,
        guard: (ctx) =>
          (ctx.lastScore === undefined || ctx.lastScore.overall < minReviewScore) &&
          ctx.attempt.attemptNumber >= maxAttempts,
      },

      // -----------------------------------------------------------------------
      // Fix phase
      // -----------------------------------------------------------------------
      {
        from: 'fixing',
        to: 'checking',
        event: WRFC_EVENTS.FIX_DONE,
      },
      {
        from: 'fixing',
        to: 'failed',
        event: WRFC_EVENTS.FIX_FAILED,
      },

      // -----------------------------------------------------------------------
      // Check phase (post-fix re-review) — three possible outcomes
      //
      // The checking→reviewing→fixing→checking cycle is bounded by maxAttempts.
      // Each full review pass (reviewing state) increments attemptNumber; once
      // attemptNumber >= maxAttempts the machine escalates instead of cycling.
      // -----------------------------------------------------------------------
      {
        from: 'checking',
        to: 'complete',
        event: WRFC_EVENTS.CHECK_PASS,
        guard: (ctx) =>
          ctx.lastScore !== undefined && ctx.lastScore.overall >= minReviewScore,
      },
      {
        from: 'checking',
        to: 'reviewing',
        event: WRFC_EVENTS.CHECK_FIX,
        guard: (ctx) =>
          (ctx.lastScore === undefined || ctx.lastScore.overall < minReviewScore) &&
          ctx.attempt.attemptNumber < maxAttempts,
      },
      {
        from: 'checking',
        to: 'escalated',
        event: WRFC_EVENTS.CHECK_ESCALATE,
        guard: (ctx) =>
          (ctx.lastScore === undefined || ctx.lastScore.overall < minReviewScore) &&
          ctx.attempt.attemptNumber >= maxAttempts,
      },

      // -----------------------------------------------------------------------
      // Error escape hatch — fail from any non-terminal state
      // -----------------------------------------------------------------------
      {
        from: ['idle', 'working', 'reviewing', 'fixing', 'checking'],
        to: 'failed',
        event: WRFC_EVENTS.FAIL,
      },
      // -----------------------------------------------------------------------
      // Cancel — user-initiated abort from any non-terminal state
      // -----------------------------------------------------------------------
      {
        from: ['idle', 'working', 'reviewing', 'fixing', 'checking'],
        to: 'cancelled',
        event: WRFC_EVENTS.CANCEL,
      },
    ],

    // Skeleton context — replaced immediately by the orchestrator
    context: {
      workId: '',
      sessionId: '',
      task: '',
      state: 'idle',
      attempt: {
        attemptNumber: 0,
        maxAttempts,
        phase: 'idle',
      },
      filesModified: [],
      startedAt: 0,
    },
  };

  return new StateMachine<WRFCState, WRFCContext>(machineConfig);
}
