/**
 * @module trigger
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Trigger types for the GoodVibes ACP runtime.
 * Triggers are condition→action rules evaluated against events by the L1 trigger engine.
 */

// ---------------------------------------------------------------------------
// Trigger condition
// ---------------------------------------------------------------------------

/** Defines when a trigger fires */
export type TriggerCondition = {
  /** Event type pattern to match (supports wildcard, e.g. "agent:*") */
  eventType: string;
  /** Human-readable description of the predicate logic */
  predicateDescription?: string;
  /** Optional JSON-serializable predicate for simple field matching */
  match?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Trigger action
// ---------------------------------------------------------------------------

/** Defines what happens when a trigger fires */
export type TriggerAction = {
  /** Key identifying the handler registered in the L1 registry */
  handlerKey: string;
  /** Parameters to pass to the handler */
  params?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Trigger definition
// ---------------------------------------------------------------------------

/** A complete trigger rule registered in the trigger engine */
export type TriggerDefinition = {
  /** Unique trigger identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Condition that causes this trigger to fire */
  condition: TriggerCondition;
  /** Action to take when the condition is met */
  action: TriggerAction;
  /** Whether this trigger is currently active */
  enabled: boolean;
  /** Maximum number of times this trigger may fire (undefined = unlimited) */
  maxFires?: number;
  /** Number of times this trigger has fired so far */
  fireCount: number;
};

// ---------------------------------------------------------------------------
// Trigger context
// ---------------------------------------------------------------------------

/** Context passed to a trigger handler when a trigger fires */
export type TriggerContext = {
  /** The event that caused the trigger to fire */
  event: Record<string, unknown>;
  /** The session context at the time of firing */
  sessionId: string;
  /** Unix timestamp (ms) when the trigger fired */
  timestamp: number;
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
