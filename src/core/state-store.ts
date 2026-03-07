/**
 * state-store.ts — Key-value state store with namespace isolation
 *
 * L1 Core — imports only from L0 types and Bun/Node std lib.
 * Zero external npm dependencies.
 */

import type { Disposable } from './event-bus.js';
import { deepMerge } from './utils.js';

/** Serialized format for a single namespace's state */
export interface SerializedNamespace {
  [key: string]: unknown;
}

/** Full serialized state for persistence */
export interface SerializedState {
  /** Schema version for migration support */
  $schema: string;
  /** ISO timestamp of when the snapshot was taken */
  timestamp: string;
  /** Namespaced state data */
  namespaces: Record<string, SerializedNamespace>;
}

/** Payload passed to onChange callbacks */
export interface StateChangeEvent {
  /** Namespace that changed */
  namespace: string;
  /** Key that changed */
  key: string;
  /** Previous value (undefined if key was new) */
  oldValue: unknown;
  /** New value (undefined if key was deleted) */
  newValue: unknown;
}

/** Callback for state change notifications */
export type StateChangeCallback = (event: StateChangeEvent) => void;

/** Current schema version for serialized state */
const STATE_SCHEMA_VERSION = '1.0.0';

/**
 * Key-value state store with namespace isolation.
 *
 * Features:
 * - Namespace isolation — separate state maps per namespace (session, runtime, plugin, etc.)
 * - onChange callback fires on any mutation with before/after values
 * - Deep merge support for partial updates
 * - Serializable to/from JSON with $schema versioning
 * - Disposable subscriptions
 *
 * @example
 * ```typescript
 * const store = new StateStore();
 * store.set('session', 'theme', 'dark');
 * store.get<string>('session', 'theme'); // 'dark'
 * store.merge('session', 'config', { port: 3000 });
 * const snapshot = store.snapshot();
 * ```
 */
export class StateStore {
  /** namespace → key → value */
  private readonly _state = new Map<string, Map<string, unknown>>();
  private readonly _listeners = new Set<StateChangeCallback>();
  private _destroyed = false;

  /**
   * Get a value from the store.
   *
   * @param namespace - Namespace key (e.g., 'session', 'runtime', 'plugin:analytics')
   * @param key - State key within the namespace
   * @returns The stored value, or undefined if not set
   */
  get<T>(namespace: string, key: string): T | undefined {
    return this._state.get(namespace)?.get(key) as T | undefined;
  }

  /**
   * Set a value in the store.
   * Fires onChange callback after the value is stored.
   *
   * @param namespace - Namespace key
   * @param key - State key
   * @param value - Value to store (must be JSON-serializable for persistence)
   */
  set<T>(namespace: string, key: string, value: T): void {
    this._assertNotDestroyed();
    if (!this._state.has(namespace)) {
      this._state.set(namespace, new Map());
    }
    const ns = this._state.get(namespace)!;
    const oldValue = ns.get(key);
    ns.set(key, value);
    this._notifyChange({ namespace, key, oldValue, newValue: value });
  }

  /**
   * Delete a key from the store.
   *
   * @param namespace - Namespace key
   * @param key - State key to delete
   * @returns true if the key existed and was deleted, false otherwise
   */
  delete(namespace: string, key: string): boolean {
    this._assertNotDestroyed();
    const ns = this._state.get(namespace);
    if (!ns || !ns.has(key)) return false;
    const oldValue = ns.get(key);
    ns.delete(key);
    this._notifyChange({ namespace, key, oldValue, newValue: undefined });
    return true;
  }

  /**
   * Deep merge a partial value into an existing object in the store.
   * If the key doesn't exist, the partial is stored as-is.
   *
   * @param namespace - Namespace key
   * @param key - State key
   * @param partial - Partial object to merge
   * @returns The merged result
   */
  merge<T extends Record<string, unknown>>(namespace: string, key: string, partial: Partial<T>): T {
    this._assertNotDestroyed();
    const existing = this.get<T>(namespace, key);
    let merged: T;
    if (existing !== undefined && typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
      merged = deepMerge(existing as T, partial);
    } else {
      merged = partial as T;
    }
    this.set(namespace, key, merged);
    return merged;
  }

  /**
   * Check if a key exists in the store.
   *
   * @param namespace - Namespace key
   * @param key - State key
   * @returns true if the key exists (even if value is null/undefined)
   */
  has(namespace: string, key: string): boolean {
    return this._state.get(namespace)?.has(key) ?? false;
  }

  /**
   * Get all keys for a namespace.
   *
   * @param namespace - Namespace key
   * @returns Array of keys in the namespace
   */
  keys(namespace: string): string[] {
    const ns = this._state.get(namespace);
    return ns ? Array.from(ns.keys()) : [];
  }

  /**
   * Get all namespace names.
   *
   * @returns Array of namespace keys
   */
  namespaces(): string[] {
    return Array.from(this._state.keys());
  }

  /**
   * Clear a specific namespace, or all state if no namespace given.
   *
   * @param namespace - Namespace to clear (clears ALL state if omitted)
   */
  clear(namespace?: string): void {
    this._assertNotDestroyed();
    if (namespace !== undefined) {
      const ns = this._state.get(namespace);
      if (ns) {
        for (const [key, oldValue] of ns) {
          this._notifyChange({ namespace, key, oldValue, newValue: undefined });
        }
        this._state.delete(namespace);
      }
    } else {
      for (const [ns, nsMap] of this._state) {
        for (const [key, oldValue] of nsMap) {
          this._notifyChange({ namespace: ns, key, oldValue, newValue: undefined });
        }
      }
      this._state.clear();
    }
  }

  /**
   * Register a callback that fires on any state mutation.
   * The callback receives namespace, key, oldValue, and newValue.
   *
   * @param callback - Change handler function
   * @returns Disposable to unsubscribe
   */
  onChange(callback: StateChangeCallback): Disposable {
    this._assertNotDestroyed();
    this._listeners.add(callback);
    return {
      dispose: () => this._listeners.delete(callback),
    };
  }

  /**
   * Create a full snapshot of the store for persistence.
   * Returns a JSON-serializable object with $schema versioning.
   *
   * @returns SerializedState snapshot
   */
  snapshot(): SerializedState {
    const namespaces: Record<string, SerializedNamespace> = {};
    for (const [ns, nsMap] of this._state) {
      namespaces[ns] = Object.fromEntries(nsMap);
    }
    return {
      $schema: STATE_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      namespaces,
    };
  }

  /**
   * Restore state from a previously taken snapshot.
   * Replaces all current state with the snapshot.
   *
   * @param state - Serialized state from snapshot()
   */
  restore(state: SerializedState): void {
    this._assertNotDestroyed();
    this._state.clear();
    for (const [ns, nsData] of Object.entries(state.namespaces)) {
      const nsMap = new Map<string, unknown>();
      for (const [key, value] of Object.entries(nsData)) {
        nsMap.set(key, value);
      }
      this._state.set(ns, nsMap);
    }
  }

  /**
   * Destroy this store. All subscriptions are removed.
   * Further calls to set/delete/merge will throw.
   */
  destroy(): void {
    this._listeners.clear();
    this._state.clear();
    this._destroyed = true;
  }

  // --- Private helpers ---

  private _notifyChange(event: StateChangeEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch {
        // Swallow errors from change listeners to protect store integrity
      }
    }
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('StateStore has been destroyed');
    }
  }
}
