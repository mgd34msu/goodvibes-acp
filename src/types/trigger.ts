/**
 * @module trigger
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Trigger types for the GoodVibes ACP runtime.
 * Triggers are condition→action rules evaluated against events by the L1 trigger engine.
 */

// ---------------------------------------------------------------------------
// Trigger definition
// ---------------------------------------------------------------------------

/** A complete trigger rule registered in the trigger engine */
export type TriggerDefinition = {
  /** Unique trigger identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Event type pattern to match:
   * - Exact: 'session:started'
   * - Wildcard prefix: 'session:*' matches any event starting with 'session:'
   * - Wildcard all: '*' matches every event
   * - Regex: '/pattern/' (string starting and ending with '/')
   */
  eventPattern: string;
  /** Optional payload predicate — JSON-serializable field matcher */
  match?: Record<string, unknown>;
  /** Registry key for the ITriggerHandler implementation */
  handlerKey: string;
  /** Whether the trigger is currently enabled (default: true) */
  enabled?: boolean;
  /** Maximum number of times to fire (undefined = unlimited) */
  maxFires?: number;
  /** Session ID to scope to (undefined = all sessions) */
  sessionId?: string;
  /** Additional metadata passed to the handler */
  metadata?: Record<string, unknown>;
  /**
   * Timeout in milliseconds for handler execution.
   * Defaults to DEFAULT_TRIGGER_TIMEOUT_MS (30000ms) if not set.
   */
  timeout?: number;
};

// ---------------------------------------------------------------------------
// Trigger context
// ---------------------------------------------------------------------------

/** Context passed to a trigger handler when a trigger fires */
export type TriggerContext = {
  /** The trigger that fired */
  trigger: TriggerDefinition;
  /** The event that caused the trigger to fire (typed as generic record; L1 narrows to EventRecord) */
  event: Record<string, unknown>;
  /** Number of times this trigger has fired (including this one) */
  fireCount: number;
};

// ---------------------------------------------------------------------------
// Trigger fire record
// ---------------------------------------------------------------------------

/** Immutable record of a trigger firing */
export type TriggerFireRecord = {
  triggerId: string;
  sessionId: string;
  timestamp: number;
  eventType: string;
  success: boolean;
  error?: string;
};
