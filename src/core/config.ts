/**
 * config.ts — Configuration management
 *
 * L1 Core — imports only from L0 types and Bun/Node std lib.
 * Zero external npm dependencies.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { RuntimeConfig } from '../types/config.js';
import type { Disposable } from './event-bus.js';
import { deepMerge } from './utils.js';

export type { RuntimeConfig };

/** Default configuration values */
const DEFAULTS: RuntimeConfig = {
  runtime: {
    mode: 'subprocess',
    port: 4242,
    host: '127.0.0.1',
    agentGracePeriodMs: 10000,
  },
  logging: {
    level: 'info',
    dir: '.goodvibes/logs',
  },
  memory: {
    dir: '.goodvibes/memory',
    maxEntries: 1000,
  },
  wrfc: {
    minReviewScore: 9.5,
    maxFixAttempts: 3,
    enableQualityGates: true,
  },
  agents: {
    maxParallel: 5,
    defaultTimeout: 300000,
  },
  health: {
    port: 4243,
    path: '/health',
  },
};

/** Environment variable prefix for overrides */
const ENV_PREFIX = 'GOODVIBES_';

/** Schema version for saved config files */
const CONFIG_SCHEMA_VERSION = '1.0.0';

/** Validation result from validate() */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Callback for config change notifications */
export type ConfigChangeCallback = (key: string, newValue: unknown, oldValue: unknown) => void;

/**
 * Deep clone an object using JSON round-trip.
 * Handles plain objects, arrays, primitives. Does NOT handle Date, Map, Set, etc.
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Get a nested value using dot-notation path.
 * e.g., get('runtime.mode') on { runtime: { mode: 'daemon' } } returns 'daemon'
 */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Set a nested value using dot-notation path.
 * Creates intermediate objects if needed.
 */
function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (
      current[part] === null ||
      current[part] === undefined ||
      typeof current[part] !== 'object'
    ) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Apply environment variable overrides.
 *
 * Naming convention:
 *   - Double underscore `__` = nesting separator (maps to a `.` in the config path)
 *   - Single underscore `_` = camelCase word boundary within a segment
 *
 * Examples:
 *   GOODVIBES_RUNTIME__MODE        → runtime.mode
 *   GOODVIBES_AGENTS__MAX_PARALLEL → agents.maxParallel
 *   GOODVIBES_WRFC__MIN_REVIEW_SCORE → wrfc.minReviewScore
 */
function applyEnvOverrides(config: RuntimeConfig): RuntimeConfig {
  const result = deepClone(config);
  for (const [envKey, envValue] of Object.entries(process.env)) {
    if (!envKey.startsWith(ENV_PREFIX)) continue;
    // Strip prefix, split on __ to get nesting segments, then camelCase each segment
    const withoutPrefix = envKey.slice(ENV_PREFIX.length);
    const configPath = withoutPrefix
      .split('__')
      .map((segment) =>
        segment
          .toLowerCase()
          // Convert _x boundaries within a segment to camelCase
          .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
      )
      .join('.');

    // Type coercion: try number, then boolean, then string
    let value: unknown = envValue;
    if (envValue !== undefined) {
      if (/^-?\d+(\.\d+)?$/.test(envValue)) {
        value = parseFloat(envValue);
      } else if (envValue === 'true') {
        value = true;
      } else if (envValue === 'false') {
        value = false;
      }
    }
    setByPath(result as Record<string, unknown>, configPath, value);
  }
  return result;
}

/**
 * Configuration management system.
 *
 * Features:
 * - Layered config: defaults → file → env vars → runtime overrides
 * - Dot-notation access (config.get('runtime.mode'))
 * - onChange callback fires on set() and merge()
 * - JSON file load/save with $schema versioning
 * - Environment variable overrides (GOODVIBES_RUNTIME_MODE=daemon)
 * - Validation against L0 config schema
 *
 * @example
 * ```typescript
 * const config = new Config();
 * await config.load('./goodvibes.config.json');
 * config.get<string>('runtime.mode'); // 'daemon'
 * config.set('wrfc.minReviewScore', 9.0);
 * ```
 */
export class Config {
  /** Merged config (defaults + file + env + runtime) */
  private _data: RuntimeConfig;
  /** Runtime overrides layer (highest priority) */
  private _overrides: Record<string, unknown> = {};
  private readonly _listeners = new Set<ConfigChangeCallback>();
  private _destroyed = false;

  constructor() {
    this._data = deepClone(DEFAULTS);
    this._applyEnv();
  }

  /**
   * Get a configuration value using dot-notation path.
   *
   * @param key - Dot-notation path (e.g., 'runtime.mode', 'wrfc.minReviewScore')
   * @returns The configuration value, or undefined if not set
   */
  get<T>(key: string): T | undefined {
    return getByPath(this._data as Record<string, unknown>, key) as T | undefined;
  }

  /**
   * Set a configuration value using dot-notation path.
   * Fires onChange callback.
   *
   * @param key - Dot-notation path
   * @param value - New value
   */
  set<T>(key: string, value: T): void {
    this._assertNotDestroyed();
    const oldValue = this.get(key);
    setByPath(this._data as Record<string, unknown>, key, value);
    setByPath(this._overrides, key, value);
    this._notifyChange(key, value, oldValue);
  }

  /**
   * Get the full configuration object.
   *
   * @returns Complete RuntimeConfig
   */
  getAll(): RuntimeConfig {
    return deepClone(this._data);
  }

  /**
   * Merge a partial configuration into the current config.
   * Deep merge — nested objects are merged, not replaced.
   *
   * @param partial - Partial configuration to merge
   */
  merge(partial: Partial<RuntimeConfig>): void {
    this._assertNotDestroyed();
    const oldSnapshot = deepClone(this._data);
    this._data = deepMerge(this._data as unknown as Record<string, unknown>, partial as Record<string, unknown>) as RuntimeConfig;
    // Notify for top-level keys that changed
    for (const key of Object.keys(partial)) {
      const newValue = this._data[key];
      const oldValue = oldSnapshot[key];
      if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
        this._notifyChange(key, newValue, oldValue);
      }
    }
  }

  /**
   * Register a callback that fires when any config value changes.
   *
   * @param callback - Change handler
   * @returns Disposable to unsubscribe
   */
  onChange(callback: ConfigChangeCallback): Disposable {
    this._assertNotDestroyed();
    this._listeners.add(callback);
    return {
      dispose: () => this._listeners.delete(callback),
    };
  }

  /**
   * Load configuration from a JSON file.
   * File contents are merged over defaults, then env vars are re-applied on top.
   *
   * @param path - Absolute or relative path to the JSON config file
   */
  async load(path: string): Promise<void> {
    this._assertNotDestroyed();
    if (!existsSync(path)) {
      return; // Silently skip missing config files
    }
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as { $schema?: string; data?: RuntimeConfig } | RuntimeConfig;
    const fileConfig = '$schema' in parsed && 'data' in parsed
      ? (parsed as { $schema: string; data: RuntimeConfig }).data
      : parsed as RuntimeConfig;
    // Merge file config over defaults
    this._data = deepMerge(deepClone(DEFAULTS) as unknown as Record<string, unknown>, fileConfig as Record<string, unknown>) as RuntimeConfig;
    this._applyEnv();
  }

  /**
   * Save the current configuration to a JSON file.
   * Writes only the runtime overrides layer (not defaults or env vars).
   *
   * @param path - Absolute or relative path to write the JSON config file
   */
  async save(path: string): Promise<void> {
    this._assertNotDestroyed();
    const output = {
      $schema: CONFIG_SCHEMA_VERSION,
      data: this._overrides,
    };
    await writeFile(path, JSON.stringify(output, null, 2), 'utf-8');
  }

  /**
   * Validate the current configuration against required fields and type constraints.
   *
   * @returns ValidationResult with errors array
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const mode = this.get<string>('runtime.mode');
    if (mode !== undefined && mode !== 'subprocess' && mode !== 'daemon') {
      errors.push(`runtime.mode must be 'subprocess' or 'daemon', got '${mode}'`);
    }
    const port = this.get<number>('runtime.port');
    if (port !== undefined && (typeof port !== 'number' || port < 1 || port > 65535)) {
      errors.push(`runtime.port must be a number between 1-65535`);
    }
    const minScore = this.get<number>('wrfc.minReviewScore');
    if (minScore !== undefined && (typeof minScore !== 'number' || minScore < 0 || minScore > 10)) {
      errors.push(`wrfc.minReviewScore must be a number between 0-10`);
    }
    const maxAttempts = this.get<number>('wrfc.maxFixAttempts');
    if (maxAttempts !== undefined && (typeof maxAttempts !== 'number' || maxAttempts < 1)) {
      errors.push(`wrfc.maxFixAttempts must be a positive number`);
    }
    const logLevel = this.get<string>('logging.level');
    const validLogLevels = ['debug', 'info', 'warn', 'error', 'silent'];
    if (logLevel !== undefined && !validLogLevels.includes(logLevel)) {
      errors.push(`logging.level must be one of ${validLogLevels.join(', ')}, got '${logLevel}'`);
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Destroy this config instance. All listeners are removed.
   */
  destroy(): void {
    this._listeners.clear();
    this._destroyed = true;
  }

  // --- Private helpers ---

  private _applyEnv(): void {
    this._data = applyEnvOverrides(this._data);
  }

  private _notifyChange(key: string, newValue: unknown, oldValue: unknown): void {
    for (const listener of this._listeners) {
      try {
        listener(key, newValue, oldValue);
      } catch (err: unknown) {
        console.error('[Config] listener error for key', key, err);
      }
    }
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('Config has been destroyed');
    }
  }
}
