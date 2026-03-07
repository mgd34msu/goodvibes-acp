/**
 * @module wrfc
 * @layer L0 — pure types, no runtime code, no imports
 *
 * WRFC (Work → Review → Fix → Check) types for the GoodVibes ACP runtime.
 * WRFC is the quality-gate loop that wraps every agent-produced work unit.
 */

// ---------------------------------------------------------------------------
// WRFC state
// ---------------------------------------------------------------------------

/**
 * States of the WRFC state machine.
 *
 * Transitions:
 *   idle → working → reviewing → (complete | fixing)
 *   fixing → checking → (complete | reviewing | escalated)
 *   Any state → failed (terminal: plugin or infrastructure error)
 */
export type WRFCState =
  | 'idle'
  | 'working'
  | 'reviewing'
  | 'fixing'
  | 'checking'
  | 'complete'
  | 'escalated'
  | 'failed';

// ---------------------------------------------------------------------------
// WRFC transitions
// ---------------------------------------------------------------------------

/** A valid state transition in the WRFC machine */
export type WRFCTransition = {
  /** Source state */
  from: WRFCState;
  /** Target state */
  to: WRFCState;
  /** Human-readable description of the guard condition */
  guardDescription?: string;
};

// ---------------------------------------------------------------------------
// Review scoring
// ---------------------------------------------------------------------------

/** A single review dimension with score and issues */
export type ReviewDimension = {
  /** Dimension name (e.g. "type-safety", "error-handling") */
  name: string;
  /** Score for this dimension (0–10) */
  score: number;
  /** Weight of this dimension in the overall score (0–1) */
  weight: number;
  /** List of issues found in this dimension */
  issues: string[];
};

/** Complete review score with per-dimension breakdown */
export type ReviewScore = {
  /** Weighted overall score (0–10) */
  overall: number;
  /** Per-dimension scores keyed by dimension name */
  dimensions: Record<string, ReviewDimension>;
  /** Whether the score meets the configured passing threshold */
  passed: boolean;
  /** Optional reviewer notes */
  notes?: string;
};

// ---------------------------------------------------------------------------
// WRFC attempt
// ---------------------------------------------------------------------------

/** Tracks the current attempt number and limits within a WRFC chain */
export type WRFCAttempt = {
  /** 1-based attempt number */
  attemptNumber: number;
  /** Maximum allowed attempts before escalation */
  maxAttempts: number;
  /** Current phase within the attempt */
  phase: WRFCState;
};

// ---------------------------------------------------------------------------
// WRFC chain context
// ---------------------------------------------------------------------------

/** Full context for an in-progress WRFC chain */
export type WRFCContext = {
  /** Unique work ID for this WRFC chain */
  workId: string;
  /** Session this chain belongs to */
  sessionId: string;
  /** The task being worked on */
  task: string;
  /** Current state */
  state: WRFCState;
  /** Current attempt information */
  attempt: WRFCAttempt;
  /** Most recent review score, if available */
  lastScore?: ReviewScore;
  /** Files modified across all attempts */
  filesModified: string[];
  /** Unix timestamp (ms) when the chain started */
  startedAt: number;
  /** Unix timestamp (ms) when the chain completed or was escalated */
  finishedAt?: number;
};

// ---------------------------------------------------------------------------
// WRFC configuration
// ---------------------------------------------------------------------------

/** Configuration for a WRFC chain */
export type WRFCConfig = {
  /** Minimum score required to pass review (0–10) */
  minReviewScore: number;
  /** Maximum fix attempts before escalation */
  maxAttempts: number;
  /** Whether quality gates are enabled */
  enableQualityGates: boolean;
};
