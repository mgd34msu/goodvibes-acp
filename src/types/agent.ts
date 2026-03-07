/**
 * @module agent
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Agent lifecycle types for the GoodVibes ACP runtime.
 */

// ---------------------------------------------------------------------------
// Agent status
// ---------------------------------------------------------------------------

/** Lifecycle states of an agent instance */
export type AgentStatus = 'spawned' | 'running' | 'completed' | 'failed' | 'cancelled';

// ---------------------------------------------------------------------------
// Agent type
// ---------------------------------------------------------------------------

/** The functional role of an agent */
export type AgentType =
  | 'engineer'
  | 'reviewer'
  | 'tester'
  | 'architect'
  | 'integrator'
  | 'deployer';

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

/** Configuration passed to IAgentSpawner.spawn() */
export type AgentConfig = {
  /** The functional role of this agent */
  type: AgentType;
  /** The task description / prompt for the agent */
  task: string;
  /** Session this agent belongs to */
  sessionId: string;
  /** Files to include as context for the agent */
  contextFiles?: string[];
  /** Model override (defaults to session model) */
  model?: string;
  /** Additional context to inject (key-value pairs) */
  context?: Record<string, unknown>;
  /** Maximum duration in milliseconds before the agent is force-cancelled */
  timeoutMs?: number;
};

// ---------------------------------------------------------------------------
// Agent handle
// ---------------------------------------------------------------------------

/** Opaque handle returned by IAgentSpawner.spawn() */
export type AgentHandle = {
  /** Unique identifier for this agent instance */
  id: string;
  /** The functional type */
  type: AgentType;
  /** Unix timestamp (ms) when the agent was spawned */
  spawnedAt: number;
};

// ---------------------------------------------------------------------------
// Agent result
// ---------------------------------------------------------------------------

/** Result returned by IAgentSpawner.result() after agent completes */
export type AgentResult = {
  /** The handle this result corresponds to */
  handle: AgentHandle;
  /** Terminal status */
  status: 'completed' | 'failed' | 'cancelled';
  /** Raw agent output / response text */
  output: string;
  /** List of files the agent modified */
  filesModified: string[];
  /** Structured errors, if any */
  errors: AgentError[];
  /** Total duration in milliseconds */
  durationMs: number;
};

/** A structured error reported by an agent */
export type AgentError = {
  /** Short error code */
  code: string;
  /** Human-readable description */
  message: string;
  /** Optional additional detail */
  detail?: unknown;
};

// ---------------------------------------------------------------------------
// Agent progress events (shared with L2 MCP bridge)
// ---------------------------------------------------------------------------

/**
 * Progress events emitted by the agent loop during execution.
 * Defined at L0 so both L2 (extensions/mcp) and L3 (plugins/agents) can use them.
 */
export type AgentProgressEvent =
  | { type: 'llm_start'; turn: number }
  | { type: 'llm_complete'; turn: number; stopReason: string; usage: { inputTokens: number; outputTokens: number } }
  | { type: 'tool_start'; turn: number; toolName: string }
  | { type: 'tool_complete'; turn: number; toolName: string; durationMs: number }
  | { type: 'tool_error'; turn: number; toolName: string; error: string };

// ---------------------------------------------------------------------------
// Agent metadata (for tracking)
// ---------------------------------------------------------------------------

/** Full metadata record stored by the agent tracker */
export type AgentMetadata = {
  id: string;
  type: AgentType;
  sessionId: string;
  task: string;
  status: AgentStatus;
  spawnedAt: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
};
