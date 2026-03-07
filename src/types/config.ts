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
  /** Runtime process configuration */
  runtime?: {
    /** Process mode: run as a subprocess per-connection or as a long-running daemon */
    mode?: 'subprocess' | 'daemon';
    /** TCP port for daemon/HTTP mode */
    port?: number;
    /** Bind address for daemon mode */
    host?: string;
    /** Grace period in ms for agent shutdown (default: 10000) */
    agentGracePeriodMs?: number;
  };
  /** Logging configuration */
  logging?: {
    /** Log verbosity */
    level?: LogLevel;
    /** Directory for log files */
    dir?: string;
  };
  /** Memory/state persistence configuration */
  memory?: {
    /** Directory for memory files */
    dir?: string;
    /** Maximum number of memory entries to retain */
    maxEntries?: number;
  };
  /** WRFC quality gate configuration */
  wrfc?: {
    minReviewScore?: number;
    maxFixAttempts?: number;
    enableQualityGates?: boolean;
  };
  /** Agent concurrency configuration */
  agents?: {
    maxParallel?: number;
    defaultTimeout?: number;
  };
  /** Health check endpoint configuration */
  health?: {
    port?: number;
    path?: string;
  };
  /** Plugin-specific configuration blocks keyed by plugin name */
  plugins?: Record<string, PluginConfig>;
  /** Allow arbitrary extension keys */
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Session config option
// ---------------------------------------------------------------------------

/** A selectable option within a select-type config option */
export type SessionConfigOptionChoice = {
  /** Machine value */
  value: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
};

/**
 * Type of the config option control.
 * @remarks ACP wire only supports 'select'. 'boolean' and 'text' are GoodVibes extensions serialized as 'select' on the wire.
 */
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
  currentValue: string;
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
