/**
 * @module config
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Configuration schema types for the GoodVibes ACP runtime.
 */

// ---------------------------------------------------------------------------
// Log level
// ---------------------------------------------------------------------------

/** Severity levels for runtime logging */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

// ---------------------------------------------------------------------------
// Runtime configuration
// ---------------------------------------------------------------------------

/** Plugin configuration block (name → arbitrary options) */
export type PluginConfig = Record<string, unknown>;

/** Top-level runtime configuration */
export type RuntimeConfig = {
  /** Process mode: run as a subprocess per-connection or as a long-running daemon */
  mode: 'subprocess' | 'daemon';
  /** TCP port for daemon mode (default: 3000) */
  port?: number;
  /** Unix socket path for MCP bridge (daemon mode) */
  socketPath?: string;
  /** Log verbosity */
  logLevel: LogLevel;
  /** Plugin-specific configuration blocks keyed by plugin name */
  plugins?: Record<string, PluginConfig>;
  /** WRFC quality gate configuration */
  wrfc?: {
    minReviewScore: number;
    maxAttempts: number;
    enableQualityGates: boolean;
  };
  /** Agent concurrency limits */
  agents?: {
    maxParallel: number;
    defaultTimeoutMs: number;
    gracePeriodMs: number;
  };
};

// ---------------------------------------------------------------------------
// Session config option
// ---------------------------------------------------------------------------

/** A selectable option within a select-type config option */
export type SessionConfigOptionChoice = {
  /** Machine value */
  value: string;
  /** Human-readable label */
  label: string;
  /** Optional description */
  description?: string;
};

/** Type of the config option control */
export type SessionConfigOptionType = 'select' | 'boolean' | 'text';

/**
 * An ACP-surfaced configuration option for a session.
 * Maps to ACP `configOptions` in session/new responses.
 */
export type SessionConfigOption = {
  /** Unique identifier for this option */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Category grouping */
  category: string;
  /** Control type */
  type: SessionConfigOptionType;
  /** Current value */
  currentValue: string | boolean;
  /** Available choices (for select type) */
  options?: SessionConfigOptionChoice[];
  /** Optional description / tooltip text */
  description?: string;
};

// ---------------------------------------------------------------------------
// Plugin manifest (config layer)
// ---------------------------------------------------------------------------

/** Plugin descriptor as used in runtime configuration (distinct from the full PluginManifest in plugin.ts) */
export type RuntimePluginConfig = {
  /** Plugin name (must match registry key) */
  name: string;
  /** Semver version string */
  version: string;
  /** The architectural layer this plugin lives in */
  layer: 'L3';
  /** Names of other plugins this plugin depends on */
  dependencies?: string[];
};
