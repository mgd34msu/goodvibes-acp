/**
 * @module events
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Event type definitions and payloads for the GoodVibes ACP runtime.
 * Every event flowing through the L1 event bus conforms to one of these types.
 */

// ---------------------------------------------------------------------------
// Generic event envelope
// ---------------------------------------------------------------------------

/** Generic typed event envelope. All runtime events conform to this shape. */
export type Event<T = unknown> = {
  /** Discriminant — the event type string (e.g. "session:created") */
  type: string;
  /** The session this event belongs to */
  sessionId: string;
  /** Unix timestamp (ms) when the event was created */
  timestamp: number;
  /** Domain-specific payload */
  payload: T;
  /**
   * Optional metadata. Reserved keys per ACP spec (W3C Trace Context):
   * - `traceparent`: W3C trace parent header
   * - `tracestate`: W3C trace state header
   * - `baggage`: W3C baggage header
   */
  _meta?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Event type string literal unions
// ---------------------------------------------------------------------------

/** Session lifecycle event types */
export type SessionEventType =
  | 'session:created'
  | 'session:activated'
  | 'session:prompt'
  | 'session:updated'
  | 'session:cancelled'
  | 'session:completed'
  | 'session:destroyed';

/** Agent lifecycle event types */
export type AgentEventType =
  | 'agent:spawned'
  | 'agent:started'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:cancelled'
  | 'agent:registered'
  | 'agent:status-changed'
  | 'agent:spawn-error';

/** WRFC state machine event types */
export type WRFCEventType =
  | 'wrfc:started'
  | 'wrfc:working'
  | 'wrfc:reviewing'
  | 'wrfc:fixing'
  | 'wrfc:checking'
  | 'wrfc:completed'
  | 'wrfc:escalated'
  | 'wrfc:failed';

/** Trigger lifecycle event types */
export type TriggerEventType =
  | 'trigger:registered'
  | 'trigger:fired'
  | 'trigger:disabled'
  | 'trigger:exhausted';

/** Tool execution event types */
export type ToolEventType =
  | 'tool:called'
  | 'tool:executed'
  | 'tool:failed';

/** Plugin lifecycle event types */
export type PluginEventType =
  | 'plugin:registered';

/** Runtime lifecycle event types */
export type RuntimeEventType =
  | 'runtime:started'
  | 'runtime:shutdown'
  | 'runtime:stopping'
  | 'runtime:stopped'
  | 'runtime:error';

/** Union of all known event type strings */
export type AnyEventType =
  | SessionEventType
  | AgentEventType
  | WRFCEventType
  | TriggerEventType
  | ToolEventType
  | PluginEventType
  | RuntimeEventType;

// ---------------------------------------------------------------------------
// Session event payloads
// ---------------------------------------------------------------------------

/**
 * Payload for session:created.
 * NOTE: sessionId is repeated here from the Event<T> envelope for consumer
 * convenience — handlers that destructure only the payload don't need to
 * reach into the outer envelope.
 */
export type SessionCreatedPayload = {
  sessionId: string;
  mode: string;
  cwd: string;
};

/**
 * Payload for session:prompt.
 * NOTE: sessionId is repeated here from the Event<T> envelope for consumer
 * convenience — handlers that destructure only the payload don't need to
 * reach into the outer envelope.
 */
export type SessionPromptPayload = {
  sessionId: string;
  prompt: string;
  attachments?: string[];
};

/**
 * Payload for session:updated.
 * NOTE: sessionId is repeated here from the Event<T> envelope for consumer
 * convenience — handlers that destructure only the payload don't need to
 * reach into the outer envelope.
 */
export type SessionUpdatedPayload = {
  sessionId: string;
  changes: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Agent event payloads
// ---------------------------------------------------------------------------

/** Payload for agent:spawned */
export type AgentSpawnedPayload = {
  agentId: string;
  agentType: string;
  sessionId: string;
  task: string;
};

/** Payload for agent:completed */
export type AgentCompletedPayload = {
  agentId: string;
  sessionId: string;
  filesModified: string[];
  durationMs: number;
};

/** Payload for agent:failed */
export type AgentFailedPayload = {
  agentId: string;
  sessionId: string;
  error: string;
  durationMs: number;
};

// ---------------------------------------------------------------------------
// WRFC event payloads
// ---------------------------------------------------------------------------

/** Payload for wrfc:started */
export type WRFCStartedPayload = {
  workId: string;
  sessionId: string;
  task: string;
  maxAttempts: number;
};

/** Payload for wrfc:completed */
export type WRFCCompletedPayload = {
  workId: string;
  sessionId: string;
  score: number;
  attempts: number;
  filesModified: string[];
};

/** Payload for wrfc:escalated */
export type WRFCEscalatedPayload = {
  workId: string;
  sessionId: string;
  reason: string;
  finalScore: number;
  attempts: number;
};

// ---------------------------------------------------------------------------
// Tool event payloads
// ---------------------------------------------------------------------------

/** Payload for tool:executed */
export type ToolExecutedPayload = {
  toolName: string;
  provider: string;
  sessionId: string;
  durationMs: number;
  success: boolean;
};

// ---------------------------------------------------------------------------
// Typed event aliases (convenience types)
// ---------------------------------------------------------------------------

/** A fully-typed session:prompt event */
export type SessionPromptEvent = Event<SessionPromptPayload> & { type: 'session:prompt' };

/** A fully-typed agent:completed event */
export type AgentCompletedEvent = Event<AgentCompletedPayload> & { type: 'agent:completed' };

/** A fully-typed wrfc:completed event */
export type WRFCCompletedEvent = Event<WRFCCompletedPayload> & { type: 'wrfc:completed' };

// ---------------------------------------------------------------------------
// ACP wire-protocol update discriminators
// ---------------------------------------------------------------------------

/** ACP wire-protocol session update discriminators */
export type AcpSessionUpdateType =
  | 'agent_message_chunk'
  | 'tool_call'
  | 'tool_call_update'
  | 'plan'
  | 'agent_thought_chunk'
  | 'session_info'
  | 'available_commands'
  | 'current_mode'
  | 'config_options_update';
