/**
 * @module constants
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Shared constants, enums, and magic values for the GoodVibes ACP runtime.
 *
 * Note: TypeScript const enums and string enums are the one case where L0 emits
 * a small amount of compiled output (enum objects). All values here are
 * pure data with zero side effects.
 */

// ---------------------------------------------------------------------------
// Layer enum
// ---------------------------------------------------------------------------

/** Architectural layers of the GoodVibes ACP runtime */
export enum Layer {
  /** L0 — Pure types, zero runtime code */
  L0 = 'L0',
  /** L1 — Core primitives (event bus, state store, etc.) */
  L1 = 'L1',
  /** L2 — Domain logic and protocol extensions */
  L2 = 'L2',
  /** L3 — Plugins (tools, reviewers, analyzers) */
  L3 = 'L3',
}

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

/** Current runtime version (semver) */
export const RUNTIME_VERSION = '0.1.0' as const;

/** State persistence schema version */
export const STATE_SCHEMA_VERSION = '1.0.0' as const;

// ---------------------------------------------------------------------------
// Default configuration values
// ---------------------------------------------------------------------------

/** Default minimum WRFC review score required to pass (0–10) */
export const DEFAULT_MIN_REVIEW_SCORE = 9.5 as const;

/** Default maximum WRFC fix attempts before escalation */
export const DEFAULT_MAX_WRFC_ATTEMPTS = 3 as const;

/** Default maximum parallel agents per session */
export const DEFAULT_MAX_PARALLEL_AGENTS = 3 as const;

/** Default agent timeout in milliseconds (5 minutes) */
export const DEFAULT_AGENT_TIMEOUT_MS = 300_000 as const;

/** Default graceful shutdown grace period in milliseconds (10 seconds) */
export const DEFAULT_SHUTDOWN_GRACE_MS = 10_000 as const;

/** Default trigger execution timeout in milliseconds (30 seconds) */
export const DEFAULT_TRIGGER_TIMEOUT_MS = 30_000 as const;

/** Default daemon TCP port */
export const DEFAULT_DAEMON_PORT = 3000 as const;

/** Default Unix socket path for the MCP bridge */
export const DEFAULT_MCP_SOCKET_PATH = '/tmp/goodvibes.sock' as const;

/** Default log level */
export const DEFAULT_LOG_LEVEL = 'info' as const;

// ---------------------------------------------------------------------------
// Registry keys
// ---------------------------------------------------------------------------

/**
 * Well-known registry keys for core capability registrations.
 * Use these constants instead of bare string literals when calling
 * registry.get() or registry.register() in L1/L2/L3 code.
 */
export const REGISTRY_KEYS = {
  /** IAgentSpawner implementation */
  AGENT_SPAWNER: 'agent:spawner',
  /** IReviewer implementations (multiple may be registered) */
  REVIEWER: 'review:reviewer',
  /** IFixer implementation */
  FIXER: 'review:fixer',
  /** IToolProvider — precision engine */
  PRECISION_TOOLS: 'tools:precision',
  /** ITextFileAccess implementation */
  FILE_ACCESS: 'fs:text',
  /** ITerminal implementation */
  TERMINAL: 'process:terminal',
  /** IAuthProvider implementations */
  AUTH_PROVIDER: 'auth:provider',
} as const;

/** Type of the REGISTRY_KEYS constant */
export type RegistryKey = (typeof REGISTRY_KEYS)[keyof typeof REGISTRY_KEYS];

// ---------------------------------------------------------------------------
// ACP pseudo-tool names (WRFC phase markers)
// ---------------------------------------------------------------------------

/**
 * ACP pseudo-tool names used to surface WRFC phase progress to ACP clients.
 * Each WRFC phase maps to a named tool_call in the ACP session/update stream.
 */
export const WRFC_TOOL_NAMES = {
  WORK: 'goodvibes_work',
  REVIEW: 'goodvibes_review',
  FIX: 'goodvibes_fix',
} as const;

/** Type of the WRFC_TOOL_NAMES constant */
export type WRFCToolName = (typeof WRFC_TOOL_NAMES)[keyof typeof WRFC_TOOL_NAMES];
