/**
 * @module directive
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Directive types for the GoodVibes ACP runtime.
 * Directives are instructions consumed by the runtime from Claude Code hooks
 * (or other sources) to take specific actions (spawn agents, escalate, etc.).
 */

// ---------------------------------------------------------------------------
// Directive action
// ---------------------------------------------------------------------------

/** The action a directive instructs the runtime to take */
export type DirectiveAction = 'spawn' | 'complete' | 'escalate' | 'fix' | 'review' | 'cancel';

// ---------------------------------------------------------------------------
// Directive priority
// ---------------------------------------------------------------------------

/** Priority level for directive processing order */
export type DirectivePriority = 'low' | 'normal' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Directive
// ---------------------------------------------------------------------------

/** A single directive queued for processing by the runtime */
export type Directive = {
  /** Unique directive identifier */
  id: string;
  /** The action to take */
  action: DirectiveAction;
  /** ACP session ID this directive is scoped to — required for per-session isolation and cancellation */
  sessionId: string;
  /** Work ID this directive relates to (WRFC chain ID). Matches WRFCContext.workId. */
  workId: string;
  /** Target agent type or session component */
  target?: string;
  /** Human-readable task description (used for spawn directives) */
  task?: string;
  /** Processing priority */
  priority: DirectivePriority;
  /** Unix timestamp (ms) when the directive was created */
  createdAt: number;
  /** Optional metadata attached to the directive */
  meta?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Directive result
// ---------------------------------------------------------------------------

/** Result status of directive processing */
export type DirectiveResultStatus = 'processed' | 'skipped' | 'failed';

/** Result of processing a single directive */
export type DirectiveResult = {
  /** The directive that was processed */
  directive: Directive;
  /** Processing outcome */
  status: DirectiveResultStatus;
  /** Error message if status is 'failed' */
  error?: string;
  /** Unix timestamp (ms) when processing completed */
  processedAt: number;
};

// ---------------------------------------------------------------------------
// Directive filter
// ---------------------------------------------------------------------------

/** Predicate used to filter directives from the queue */
export type DirectiveFilter = {
  /** Filter by action type */
  action?: DirectiveAction;
  /** Filter by session ID — enables per-session isolation */
  sessionId?: string;
  /** Filter by work ID */
  workId?: string;
  /** Filter by target */
  target?: string;
  /** Filter by minimum priority */
  minPriority?: DirectivePriority;
};
