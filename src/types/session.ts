/**
 * @module session
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Session types, states, and context for the GoodVibes ACP runtime.
 */

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

/** Lifecycle states of an ACP session */
export type SessionState = 'idle' | 'active' | 'cancelled' | 'completed';

// ---------------------------------------------------------------------------
// Session mode
// ---------------------------------------------------------------------------

/**
 * Named operating modes for a session.
 * Each mode controls which guardrails, tools, and behaviors are active.
 */
export type SessionMode = 'vibecoding' | 'justvibes' | 'sandbox' | 'plan';

// ---------------------------------------------------------------------------
// Session configuration
// ---------------------------------------------------------------------------

/**
 * An environment variable entry for stdio MCP server subprocesses.
 * Matches ACP spec `EnvVariable` (KB-03).
 */
export type EnvVariable = {
  name: string;
  value: string;
  _meta?: { [key: string]: unknown } | null;
};

/**
 * An HTTP header entry for HTTP/SSE MCP server connections.
 * Matches ACP spec `HttpHeader` (KB-03).
 */
export type HttpHeader = {
  name: string;
  value: string;
  _meta?: { [key: string]: unknown } | null;
};

/**
 * MCP server connection definition.
 *
 * ACP spec discriminated union (use `type` to narrow):
 * - `'stdio'`: spawn a local subprocess (`command`, optional `args`, optional `env`)
 * - `'http'` | `'sse'`: connect to a remote HTTP/SSE endpoint (`url`, optional `headers`)
 */
export type MCPServerConfig =
  | {
      /** Server name / identifier */
      name: string;
      /** Executable command to spawn — presence of this field identifies stdio variant */
      command: string;
      /** Command-line arguments */
      args: string[];
      /** Additional environment variables for the subprocess */
      env: Record<string, string>;
    }
  | {
      /** Discriminator — identifies this as an HTTP or SSE MCP server */
      type: 'http' | 'sse';
      /** Server name / identifier */
      name: string;
      /** HTTP or SSE endpoint URL */
      url: string;
      /** Optional HTTP headers (e.g. Authorization) */
      headers?: HttpHeader[];
    };

/** Static configuration for a session */
export type SessionConfig = {
  /** Working directory for the session */
  cwd: string;
  /** Operating mode */
  mode: SessionMode;
  /** Model identifier (e.g. "claude-sonnet-4-5") */
  model?: string;
  /** MCP servers to connect for this session */
  mcpServers?: MCPServerConfig[];
  /** Arbitrary config options surfaced via ACP configOptions */
  configOptions?: Record<string, SessionConfigOptionValue>;
};

/** The runtime value of a config option */
export type SessionConfigOptionValue = string;

// ---------------------------------------------------------------------------
// Session context
// ---------------------------------------------------------------------------

/** A message in the conversation history */
export type HistoryMessage = {
  /**
   * Message role.
   * - 'user'      — human turn
   * - 'assistant' — agent turn
   * - 'thinking'  — agent extended thinking/reasoning block (emitted as
   *                 agent_thought_chunk on history replay per ACP prompt-turn spec)
   */
  role: 'user' | 'assistant' | 'thinking';
  /** Message content — string for plain text, or an array of content blocks for rich content */
  content: Array<{ type: string; [key: string]: unknown }> | string;
  /** Unix timestamp (ms) */
  timestamp: number;
};

/** Full runtime context for an active session */
export type SessionContext = {
  /** Unique session identifier */
  id: string;
  /** Current lifecycle state */
  state: SessionState;
  /** Static session configuration */
  config: SessionConfig;
  /** Conversation history */
  history: HistoryMessage[];
  /** Unix timestamp (ms) when session was created */
  createdAt: number;
  /** Unix timestamp (ms) when session was last updated */
  updatedAt: number;
  /** Auto-generated session title from the first user prompt (first 100 chars) */
  title?: string;
};

// ---------------------------------------------------------------------------
// Session summary (lightweight, for listings)
// ---------------------------------------------------------------------------

/**
 * Lightweight session summary for listings.
 *
 * NOTE: `cwd` and `mode` are denormalized from SessionContext.config for
 * convenience in list views, avoiding a full context load just to display
 * summary rows. This is intentional.
 */
export type SessionSummary = {
  id: string;
  state: SessionState;
  mode: SessionMode;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  /** Auto-generated session title from the first user prompt */
  title?: string;
};
