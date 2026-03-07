/**
 * @module registry
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Registry contracts — interfaces that upper layers implement and lower layers
 * consume through the L1 capability registry. L0 defines the contract;
 * L3 provides the implementation; L1 wires them together.
 */

import type { TriggerDefinition, TriggerContext } from './trigger.js';
import type { AgentConfig, AgentHandle, AgentResult, AgentStatus } from './agent.js';

// ---------------------------------------------------------------------------
// Supporting value types
// ---------------------------------------------------------------------------

/** Definition of a single tool exposed by an IToolProvider */
export type ToolDefinition = {
  /** Unique tool name within the provider */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema describing the input parameters */
  inputSchema: Record<string, unknown>;
};

/** Generic tool execution result envelope */
export type ToolResult<T = unknown> = {
  /** Whether the tool call succeeded */
  success: boolean;
  /** Tool-specific output (cast by callers who know the tool type) */
  data?: T;
  /** Error message if success is false */
  error?: string;
  /** Optional structured error detail */
  errorDetail?: Record<string, unknown>;
  /** Execution duration in milliseconds */
  durationMs?: number;
};

/** The output from a completed work unit (agent run) */
export type WorkResult = {
  /** Session this work belongs to */
  sessionId: string;
  /** The task that was worked on */
  task: string;
  /** Raw agent output */
  output: string;
  /** Files the agent modified */
  filesModified: string[];
  /** Structured errors encountered during work */
  errors: string[];
  /** Duration in milliseconds */
  durationMs: number;
};

/** Result from a review pass */
export type ReviewResult = {
  /** Session this review belongs to */
  sessionId: string;
  /** Overall score (0–10) */
  score: number;
  /** Per-dimension scores keyed by dimension name */
  dimensions: Record<string, { score: number; weight: number; issues: string[] }>;
  /** Whether the review passed the minimum score threshold */
  passed: boolean;
  /** Issues to address in the next fix attempt */
  issues: string[];
  /** Optional reviewer notes */
  notes?: string;
};

/** Result from a fix attempt */
export type FixResult = {
  /** Session this fix belongs to */
  sessionId: string;
  /** Whether the fix was applied successfully */
  success: boolean;
  /** Files modified during the fix */
  filesModified: string[];
  /** Issues that were resolved */
  resolvedIssues: string[];
  /** Issues that remain unresolved */
  remainingIssues: string[];
};

/** Authentication method descriptor */
export type AuthMethod = {
  /** Method identifier (e.g. "api-key", "oauth", "bearer") */
  id: string;
  /** Human-readable method name */
  name: string;
};

/** Authentication request */
export type AuthRequest = {
  /** Method to use */
  method: string;
  /** Method-specific credentials */
  credentials: Record<string, unknown>;
};

/** Authentication result */
export type AuthResult = {
  /** Whether authentication succeeded */
  success: boolean;
  /** Identity token or session token on success */
  token?: string;
  /** Error description on failure */
  error?: string;
};

/** Options for reading a text file via ITextFileAccess */
export type ReadOptions = {
  /** Encoding (default: utf-8) */
  encoding?: string;
  /** Read from editor buffer if available (default: true) */
  preferBuffer?: boolean;
};

/** Options for writing a text file via ITextFileAccess */
export type WriteOptions = {
  /** Encoding (default: utf-8) */
  encoding?: string;
  /** Whether to overwrite an existing file (default: true) */
  overwrite?: boolean;
};

/** Opaque handle to a running terminal process */
export type TerminalHandle = {
  /** Unique handle identifier */
  id: string;
  /** The command that was started */
  command: string;
  /** Unix timestamp (ms) when the terminal was created */
  createdAt: number;
};

/** Result of a terminal process exit */
export type ExitResult = {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
  /** Duration in milliseconds */
  durationMs: number;
};

// ---------------------------------------------------------------------------
// Registry interfaces
// ---------------------------------------------------------------------------

/**
 * Reviews a completed work unit and returns a scored result.
 * Implementations MUST NOT throw — return score 0 with error details instead.
 */
export interface IReviewer {
  /** Unique reviewer identifier (used for selection by capability) */
  readonly id: string;
  /** Capabilities this reviewer covers (e.g. ["typescript", "security"]) */
  readonly capabilities: string[];
  /** Review the work and return a scored result */
  review(workResult: WorkResult): Promise<ReviewResult>;
}

/**
 * Applies fixes based on a review result.
 * Implementations MUST be idempotent — running fix twice produces the same output.
 */
export interface IFixer {
  /** Apply fixes based on the review result */
  fix(reviewResult: ReviewResult): Promise<FixResult>;
}

/**
 * Provides a named set of executable tools.
 * Implementations MUST handle unknown tool names gracefully (return error result, not throw).
 */
export interface IToolProvider {
  /** Provider name — used as registry key */
  readonly name: string;
  /** Tool definitions exposed by this provider */
  readonly tools: ToolDefinition[];
  /** Execute a named tool with the given parameters */
  execute<T = unknown>(toolName: string, params: unknown): Promise<ToolResult<T>>;
}

/**
 * Handles a specific trigger type when it fires.
 * Implementations MUST be idempotent and complete within the trigger timeout.
 */
export interface ITriggerHandler {
  /** Returns true if this handler can process the given trigger */
  canHandle(trigger: TriggerDefinition): boolean;
  /** Execute the handler for the fired trigger */
  execute(trigger: TriggerDefinition, context: TriggerContext): Promise<void>;
}

/**
 * Provides authentication for a service or endpoint.
 * Implementations MUST handle auth failure without crashing and MUST support cancellation.
 */
export interface IAuthProvider {
  /** Authentication methods supported by this provider */
  readonly methods: AuthMethod[];
  /** Authenticate using the given request */
  authenticate(params: AuthRequest): Promise<AuthResult>;
}

/**
 * Editor-aware text file read/write.
 * Read returns the latest editor buffer state when available.
 * Write triggers an editor buffer refresh.
 *
 * Intentionally narrow — no exists/mkdir/stat/readDir.
 * Precision tools use direct fs for those operations.
 */
export interface ITextFileAccess {
  /** Read a text file, preferring editor buffer state */
  readTextFile(path: string, options?: ReadOptions): Promise<string>;
  /** Write a text file and trigger editor refresh */
  writeTextFile(path: string, content: string, options?: WriteOptions): Promise<void>;
}

/**
 * Creates and manages editor-visible terminal processes.
 * For user-visible operations (build, test, deploy).
 * precision_exec bypasses this for internal operations.
 */
export interface ITerminal {
  /** Create a new terminal process and return its handle */
  create(command: string, args?: string[]): Promise<TerminalHandle>;
  /** Get the current output of a terminal */
  output(handle: TerminalHandle): Promise<string>;
  /** Wait for the terminal process to exit */
  waitForExit(handle: TerminalHandle): Promise<ExitResult>;
  /** Forcibly kill the terminal process */
  kill(handle: TerminalHandle): Promise<void>;
}

/**
 * Spawns and tracks agent instances.
 * result() resolves on completion (success or failure) — callers await result(),
 * no implicit event bus coupling.
 */
export interface IAgentSpawner {
  /** Spawn an agent and return an opaque handle */
  spawn(config: AgentConfig): Promise<AgentHandle>;
  /** Await the agent's result (resolves on success or failure) */
  result(handle: AgentHandle): Promise<AgentResult>;
  /** Cancel a running agent */
  cancel(handle: AgentHandle): Promise<void>;
  /** Get the current status of an agent */
  status(handle: AgentHandle): AgentStatus;
}
