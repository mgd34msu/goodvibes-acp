/**
 * @module plugin
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Plugin manifest and registration types for the GoodVibes ACP runtime.
 * These types define the contract between L3 plugins and the runtime.
 */

// ---------------------------------------------------------------------------
// Plugin manifest
// ---------------------------------------------------------------------------

/** The architectural layer a plugin belongs to */
export type PluginLayer = 'L3';

/** Full manifest describing a plugin */
export type PluginManifest = {
  /** Unique plugin name (used as registry key) */
  name: string;
  /** Semver version string */
  version: string;
  /** Human-readable description */
  description: string;
  /** Architectural layer (always L3 for plugins) */
  layer: PluginLayer;
  /** Other plugin names this plugin depends on */
  dependencies?: string[];
  /** Capability tags (e.g. ["tools", "reviewer", "file-access"]) */
  capabilities?: string[];
};

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

/**
 * Plugin registration contract.
 * The register function receives the L1 registry and wires the plugin's
 * capabilities into it. The shutdown function cleans up resources.
 *
 * NOTE: The actual registry type is defined in L1 and not imported here.
 * The `registry` parameter uses `unknown` — L1 will cast it appropriately
 * when calling register().
 */
export type PluginRegistration = {
  /** Plugin manifest */
  manifest: PluginManifest;
  /**
   * Register this plugin's capabilities into the L1 registry.
   * Called by main.ts during bootstrap.
   */
  register: (registry: unknown) => void;
  /**
   * Clean up plugin resources during shutdown.
   * Called in reverse layer order by the shutdown sequence.
   */
  shutdown?: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Plugin status
// ---------------------------------------------------------------------------

/** Runtime status of a loaded plugin */
export type PluginStatus = 'loading' | 'active' | 'error' | 'disabled';

/** Runtime state of a plugin instance */
export type PluginState = {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Current status */
  status: PluginStatus;
  /** Error if status is 'error' */
  error?: string;
  /** Unix timestamp (ms) when the plugin was loaded */
  loadedAt?: number;
};
