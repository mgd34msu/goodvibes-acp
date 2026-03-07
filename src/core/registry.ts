/**
 * registry.ts — Capability registry for interface implementations
 *
 * L1 Core — imports only from L0 types and Bun/Node std lib.
 * Zero external npm dependencies.
 *
 * This is the primary mechanism for upper layers to provide implementations
 * to lower layers without creating upward import dependencies.
 * L3 plugins register implementations at startup (main.ts).
 * L2/L1 consumers call get<T>(key) to retrieve them.
 */

/**
 * Registry for typed capability implementations.
 *
 * Features:
 * - Typed registration: register<IReviewer>('code-review', impl)
 * - Single-value registration (get) — throws on duplicate keys
 * - Multi-value registration (registerMany/getAll) — supports multiple implementations per kind
 * - Simple Map-based — no DI framework, no autowiring, no scanning
 *
 * @example
 * ```typescript
 * const registry = new Registry();
 * // L3 registers at startup:
 * registry.register<IToolProvider>('precision', precisionPlugin);
 * registry.registerMany<IReviewer>('reviewer', 'code-review', codeReviewer);
 * registry.registerMany<IReviewer>('reviewer', 'security-audit', securityReviewer);
 *
 * // L2 consumes:
 * const precision = registry.get<IToolProvider>('precision');
 * const reviewers = registry.getAll<IReviewer>('reviewer');
 * ```
 */
export class Registry {
  /** Single-value registry: key → implementation */
  private readonly _single = new Map<string, unknown>();
  /** Multi-value registry: kind → Map<key, implementation> */
  private readonly _multi = new Map<string, Map<string, unknown>>();

  /**
   * Register a single implementation under a unique key.
   * Throws if the key is already registered.
   *
   * @param key - Unique registry key (e.g., 'precision', 'auth')
   * @param impl - Implementation to register
   * @throws Error if key is already registered
   */
  register<T>(key: string, impl: T): void {
    if (this._single.has(key)) {
      throw new Error(
        `Registry: key '${key}' is already registered. Use a unique key or unregister first.`
      );
    }
    this._single.set(key, impl);
  }

  /**
   * Register an implementation in a multi-value collection.
   * Multiple implementations can be registered under the same `kind`.
   * Throws if the same kind+key combination is already registered.
   *
   * @param kind - Collection name (e.g., 'reviewer', 'tool-provider')
   * @param key - Unique key within the kind (e.g., 'code-review', 'security-audit')
   * @param impl - Implementation to register
   * @throws Error if kind+key combination is already registered
   */
  registerMany<T>(kind: string, key: string, impl: T): void {
    if (!this._multi.has(kind)) {
      this._multi.set(kind, new Map());
    }
    const kindMap = this._multi.get(kind)!;
    if (kindMap.has(key)) {
      throw new Error(
        `Registry: multi-value key '${kind}/${key}' is already registered.`
      );
    }
    kindMap.set(key, impl);
  }

  /**
   * Get a single registered implementation by key.
   * Throws if the key is not found.
   *
   * @param key - Registry key
   * @returns The registered implementation
   * @throws Error if key is not registered
   */
  get<T>(key: string): T {
    if (!this._single.has(key)) {
      throw new Error(
        `Registry: key '${key}' is not registered. Available: [${Array.from(this._single.keys()).join(', ')}]`
      );
    }
    return this._single.get(key) as T;
  }

  /**
   * Get a single registered implementation by key, returning undefined if not found.
   *
   * @param key - Registry key
   * @returns The registered implementation, or undefined
   */
  getOptional<T>(key: string): T | undefined {
    return this._single.get(key) as T | undefined;
  }

  /**
   * Get all implementations registered under a kind.
   * Returns an empty array if no implementations are registered for the kind.
   *
   * @param kind - Collection name (e.g., 'reviewer')
   * @returns Array of all registered implementations for this kind
   */
  getAll<T>(kind: string): T[] {
    const kindMap = this._multi.get(kind);
    if (!kindMap) return [];
    return Array.from(kindMap.values()) as T[];
  }

  /**
   * Get a specific implementation from a multi-value collection.
   *
   * @param kind - Collection name
   * @param key - Key within the collection
   * @returns The implementation, or undefined if not found
   */
  getFromKind<T>(kind: string, key: string): T | undefined {
    return this._multi.get(kind)?.get(key) as T | undefined;
  }

  /**
   * Check if a key is registered in the single-value registry.
   *
   * @param key - Registry key to check
   * @returns true if the key is registered
   */
  has(key: string): boolean {
    return this._single.has(key);
  }

  /**
   * Check if a kind+key combination is registered in the multi-value registry.
   *
   * @param kind - Collection name
   * @param key - Key within the collection (optional — checks if kind exists if omitted)
   * @returns true if registered
   */
  hasMany(kind: string, key?: string): boolean {
    if (key === undefined) {
      return this._multi.has(kind) && (this._multi.get(kind)?.size ?? 0) > 0;
    }
    return this._multi.get(kind)?.has(key) ?? false;
  }

  /**
   * Get all registered keys in the single-value registry.
   *
   * @returns Array of registered keys
   */
  keys(): string[] {
    return Array.from(this._single.keys());
  }

  /**
   * Get all registered kinds in the multi-value registry.
   *
   * @returns Array of registered kind names
   */
  kinds(): string[] {
    return Array.from(this._multi.keys());
  }

  /**
   * Unregister a single-value key.
   *
   * @param key - Key to remove
   * @returns true if the key was removed, false if it didn't exist
   */
  unregister(key: string): boolean {
    return this._single.delete(key);
  }

  /**
   * Unregister a specific key from a multi-value kind.
   *
   * @param kind - Collection name
   * @param key - Key to remove
   * @returns true if the key was removed, false if it didn't exist
   */
  unregisterMany(kind: string, key: string): boolean {
    return this._multi.get(kind)?.delete(key) ?? false;
  }

  /**
   * Clear all registrations — both single-value and multi-value.
   */
  clear(): void {
    this._single.clear();
    this._multi.clear();
  }
}
