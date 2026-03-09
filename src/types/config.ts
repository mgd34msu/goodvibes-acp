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

/**
 * A grouped set of options for a select-type config option.
 * Supports the ACP spec grouped options format.
 */
export type SessionConfigSelectGroup = {
  /** Group display label */
  label: string;
  /** Options within this group */
  options: SessionConfigOptionChoice[];
};

/**
 * Category grouping for session config options.
 * Matches ACP spec `SessionConfigOptionCategory`.
 */
export type SessionConfigOptionCategory = 'model' | 'general' | 'advanced' | string;

/** A selectable option within a select-type config option */
export type SessionConfigOptionChoice = {
  /** Machine value */
  value: string;
  /**
   * Human-readable display name (ACP spec: `name: string`).
   * @remarks Required per KB-03 ConfigOptionValue spec; field renamed from `label` for SDK alignment.
   */
  name: string;
  /** Optional description */
  description?: string;
  /** Optional extensibility metadata per KB-08 */
  _meta?: Record<string, unknown>;
};

/**
 * Type of the config option control.
 * @remarks The ACP spec (KB-03 line 258) defines only `"select"` as a valid config option type.
 * The values `'boolean'` and `'text'` are not currently defined in the ACP protocol and
 * must NOT be sent over the wire. Define a separate internal type if non-select variants
 * are needed for internal use.
 */
export type SessionConfigOptionType = 'select';

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
  category?: SessionConfigOptionCategory;
  /** Control type */
  type: SessionConfigOptionType;
  /**
   * Current value of the config option.
   * @remarks KB-01 (line 302) specifies `string | boolean`; KB-03 (line 266) specifies `string`.
   * Since `SessionConfigOptionType` is restricted to `'select'` (per KB-03), only string
   * values apply. If boolean type support is added in future, widen to `string | boolean`.
   */
  currentValue: string;
  /** Available choices (for select type) — supports flat or grouped options */
  options: SessionConfigOptionChoice[] | SessionConfigSelectGroup[];
  /** Optional description / tooltip text */
  description?: string;
  /** Optional extensibility metadata per ACP spec */
  _meta?: { [key: string]: unknown } | null;
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
