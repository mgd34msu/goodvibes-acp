/**
 * @module services/registry
 * @layer L2 — extensions, imports from L0 and L1 only
 *
 * Named service registry for external API connections.
 * Manages service configurations with JSON file persistence
 * and emits events via EventBus on register/remove.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Authentication configuration for a named service */
export interface ServiceAuth {
  type: 'bearer' | 'basic' | 'api-key';
  /** Bearer token (for type: 'bearer') */
  token?: string;
  /** Username (for type: 'basic') */
  username?: string;
  /** Password (for type: 'basic') */
  password?: string;
  /** Header name (for type: 'api-key', defaults to 'X-API-Key') */
  header?: string;
  /** API key value (for type: 'api-key') */
  key?: string;
}

/** Configuration for a registered external service */
export interface ServiceConfig {
  /** Base endpoint URL */
  endpoint: string;
  /** Authentication configuration */
  auth?: ServiceAuth;
  /** Additional headers to include on all requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/** A registered service entry — name + config */
export interface ServiceEntry {
  /** Unique service name */
  name: string;
  /** Service configuration */
  config: ServiceConfig;
  /** ISO timestamp when the service was registered */
  registeredAt: string;
}

// ---------------------------------------------------------------------------
// Internal persistence shape
// ---------------------------------------------------------------------------

interface ServiceStore {
  $schema: string;
  services: ServiceEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = '1.0.0';
const SERVICES_FILE = 'services.json';

// ---------------------------------------------------------------------------
// ServiceRegistry
// ---------------------------------------------------------------------------

/**
 * Named registry for external service configurations.
 *
 * Stores configs in a single `services.json` file within `basePath`.
 * All mutations are in-memory until `save()` is called explicitly.
 * Call `load()` at startup to restore persisted registrations.
 *
 * Events emitted:
 * - `service:registered` — when a service is registered
 * - `service:removed` — when a service is unregistered
 * - `service:loaded` — when the store is loaded from disk
 * - `service:saved` — when the store is persisted to disk
 */
export class ServiceRegistry {
  private readonly _basePath: string;
  private readonly _bus: EventBus;
  private _store: ServiceStore;

  constructor(basePath: string, eventBus: EventBus) {
    this._basePath = basePath;
    this._bus = eventBus;
    this._store = this._emptyStore();
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Load the service store from disk.
   * If the file does not exist, the in-memory store is reset to empty.
   * Emits `service:loaded`.
   */
  async load(): Promise<void> {
    const filePath = join(this._basePath, SERVICES_FILE);
    try {
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as ServiceStore;
      this._store = {
        $schema: parsed.$schema ?? SCHEMA_VERSION,
        services: parsed.services ?? [],
      };
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        this._store = this._emptyStore();
      } else {
        throw err;
      }
    }
    this._bus.emit('service:loaded', { basePath: this._basePath });
  }

  /**
   * Persist the current in-memory store to disk.
   * Creates the basePath directory if it does not exist.
   * Emits `service:saved`.
   */
  async save(): Promise<void> {
    await mkdir(this._basePath, { recursive: true });
    const filePath = join(this._basePath, SERVICES_FILE);
    await writeFile(filePath, JSON.stringify(this._store, null, 2), 'utf-8');
    this._bus.emit('service:saved', { basePath: this._basePath });
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /**
   * Register a named service.
   * If a service with the same name already exists, it is overwritten.
   * Emits `service:registered`.
   *
   * @param name   Unique service identifier
   * @param config Service configuration
   */
  register(name: string, config: ServiceConfig): void {
    const entry: ServiceEntry = {
      name,
      config,
      registeredAt: new Date().toISOString(),
    };
    const idx = this._store.services.findIndex((s) => s.name === name);
    if (idx >= 0) {
      this._store.services[idx] = entry;
    } else {
      this._store.services.push(entry);
    }
    this._bus.emit('service:registered', { name, config });
  }

  /**
   * Retrieve a service configuration by name.
   *
   * @param name Service identifier
   * @returns ServiceConfig if found, undefined otherwise
   */
  get(name: string): ServiceConfig | undefined {
    return this._store.services.find((s) => s.name === name)?.config;
  }

  /**
   * List all registered service entries (name + config + registeredAt).
   *
   * @returns Snapshot array of all entries
   */
  list(): ServiceEntry[] {
    return [...this._store.services];
  }

  /**
   * Unregister a named service.
   * No-op if the service is not registered.
   * Emits `service:removed`.
   *
   * @param name Service identifier to remove
   */
  remove(name: string): void {
    const before = this._store.services.length;
    this._store.services = this._store.services.filter((s) => s.name !== name);
    if (this._store.services.length < before) {
      this._bus.emit('service:removed', { name });
    }
  }

  /**
   * Check whether a named service is registered.
   *
   * @param name Service identifier
   */
  has(name: string): boolean {
    return this._store.services.some((s) => s.name === name);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _emptyStore(): ServiceStore {
    return { $schema: SCHEMA_VERSION, services: [] };
  }
}
