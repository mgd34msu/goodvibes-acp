/**
 * hook-engine.ts — Generic pre/post hook execution
 *
 * L1 Core — imports only from L0 types and Bun/Node std lib.
 * Zero external npm dependencies.
 */

import type { Disposable } from './event-bus.js';

/** Phase of hook execution */
export type HookPhase = 'pre' | 'post';

/**
 * A pre-hook handler.
 * Receives context and returns a (potentially modified) context.
 * Returning undefined/void keeps the context unchanged.
 */
export type PreHookHandler<TContext> = (
  context: TContext
) => TContext | undefined | void | Promise<TContext | undefined | void>;

/**
 * A post-hook handler.
 * Receives context and result. Cannot modify either.
 */
export type PostHookHandler<TContext> = (
  context: TContext,
  result: unknown
) => void | Promise<void>;

/** A registered hook entry */
export interface HookRegistration {
  /** Hook point name (e.g., 'agent:spawn', 'wrfc:review') */
  readonly hookPoint: string;
  /** Phase: 'pre' or 'post' */
  readonly phase: HookPhase;
  /** Priority — lower number runs first (default: 50) */
  readonly priority: number;
  /** Unique registration ID (auto-generated) */
  readonly id: string;
}

/** Internal hook entry with handler */
interface HookEntry<TContext = unknown> extends HookRegistration {
  preHandler?: PreHookHandler<TContext>;
  postHandler?: PostHookHandler<TContext>;
}

/**
 * Generic pre/post hook execution engine.
 *
 * Features:
 * - Pre hooks can modify context (chain pattern — output of one feeds into next)
 * - Post hooks receive final context and result but cannot modify them
 * - Priority ordering: lower number runs first (default: 50)
 * - Error in one hook does not stop others (error isolation)
 * - Generic — no domain knowledge about hook point names
 *
 * @example
 * ```typescript
 * const hooks = new HookEngine();
 *
 * // Pre hook: can modify context
 * hooks.register('agent:spawn', 'pre', async (ctx) => ({
 *   ...ctx,
 *   injectedAt: Date.now(),
 * }));
 *
 * // Execute: runs all pre hooks in priority order
 * const modified = await hooks.execute('agent:spawn', { agentType: 'engineer' });
 *
 * // Post hook: receives result, cannot modify
 * hooks.register('agent:spawn', 'post', (ctx, result) => {
 *   console.log('Agent spawned:', result);
 * });
 * await hooks.executePost('agent:spawn', modified, agentHandle);
 * ```
 */
export class HookEngine {
  /** hookPoint → phase → sorted HookEntry[] */
  private readonly _hooks = new Map<string, Map<HookPhase, HookEntry[]>>();
  private _idCounter = 0;
  private _destroyed = false;

  /**
   * Register a pre-hook handler for a hook point.
   *
   * @param hookPoint - Named hook point (e.g., 'agent:spawn')
   * @param phase - 'pre' or 'post'
   * @param handler - Hook handler function
   * @param priority - Execution order (lower = runs first, default: 50)
   * @returns Disposable to unregister the hook
   */
  register<TContext>(
    hookPoint: string,
    phase: 'pre',
    handler: PreHookHandler<TContext>,
    priority?: number
  ): Disposable;

  register<TContext>(
    hookPoint: string,
    phase: 'post',
    handler: PostHookHandler<TContext>,
    priority?: number
  ): Disposable;

  register<TContext>(
    hookPoint: string,
    phase: HookPhase,
    handler: PreHookHandler<TContext> | PostHookHandler<TContext>,
    priority = 50
  ): Disposable {
    this._assertNotDestroyed();
    const id = `hook_${++this._idCounter}`;

    if (!this._hooks.has(hookPoint)) {
      this._hooks.set(hookPoint, new Map());
    }
    const phaseMap = this._hooks.get(hookPoint)!;
    if (!phaseMap.has(phase)) {
      phaseMap.set(phase, []);
    }
    const entries = phaseMap.get(phase)!;

    const entry: HookEntry<TContext> = {
      id,
      hookPoint,
      phase,
      priority,
    };
    if (phase === 'pre') {
      (entry as HookEntry<TContext>).preHandler = handler as PreHookHandler<TContext>;
    } else {
      (entry as HookEntry<TContext>).postHandler = handler as PostHookHandler<TContext>;
    }

    // Insert in priority order (lower number = earlier = lower index)
    let insertAt = entries.length;
    for (let i = 0; i < entries.length; i++) {
      if (priority < entries[i].priority) {
        insertAt = i;
        break;
      }
    }
    entries.splice(insertAt, 0, entry as HookEntry);

    return {
      dispose: () => {
        const current = phaseMap.get(phase);
        if (current) {
          const idx = current.findIndex((e) => e.id === id);
          if (idx !== -1) current.splice(idx, 1);
        }
      },
    };
  }

  /**
   * Execute all pre-hooks for a hook point in priority order.
   * Each pre-hook can modify the context; the modified context is passed to the next hook.
   *
   * @param hookPoint - Named hook point
   * @param context - Initial context
   * @returns Final context after all pre-hooks have run
   */
  async execute<T>(hookPoint: string, context: T): Promise<T> {
    this._assertNotDestroyed();
    const phaseMap = this._hooks.get(hookPoint);
    const entries = phaseMap?.get('pre') ?? [];

    let current = context;
    for (const entry of entries) {
      try {
        const result = await (entry as HookEntry<T>).preHandler?.(current);
        if (result !== undefined && result !== null) {
          current = result as T;
        }
      } catch (err) {
        // Error isolation: log but don't crash (ACP KB-08: log for debugging)
        console.warn(`[HookEngine] Pre-hook failed at '${hookPoint}':`, err);
      }
    }
    return current;
  }

  /**
   * Execute all post-hooks for a hook point in priority order.
   * Post-hooks receive context and result but cannot modify them.
   *
   * @param hookPoint - Named hook point
   * @param context - The final context (after operation completed)
   * @param result - The operation result
   */
  async executePost<T>(hookPoint: string, context: T, result: unknown): Promise<void> {
    this._assertNotDestroyed();
    const phaseMap = this._hooks.get(hookPoint);
    const entries = phaseMap?.get('post') ?? [];

    for (const entry of entries) {
      try {
        await (entry as HookEntry<T>).postHandler?.(context, result);
      } catch (err) {
        // Error isolation: log but don't crash (ACP KB-08: log for debugging)
        console.warn(`[HookEngine] Post-hook failed at '${hookPoint}':`, err);
      }
    }
  }

  /**
   * List all registered hooks, optionally filtered by hook point.
   *
   * @param hookPoint - Optional filter — returns all hooks if omitted
   * @returns Array of HookRegistration objects
   */
  list(hookPoint?: string): HookRegistration[] {
    const result: HookRegistration[] = [];
    for (const [hp, phaseMap] of this._hooks) {
      if (hookPoint !== undefined && hp !== hookPoint) continue;
      for (const entries of phaseMap.values()) {
        for (const entry of entries) {
          result.push({
            id: entry.id,
            hookPoint: entry.hookPoint,
            phase: entry.phase,
            priority: entry.priority,
          });
        }
      }
    }
    return result;
  }

  /**
   * Clear all hooks for a specific hook point, or all hooks if no point given.
   *
   * @param hookPoint - Hook point to clear (clears ALL if omitted)
   */
  clear(hookPoint?: string): void {
    if (hookPoint !== undefined) {
      this._hooks.delete(hookPoint);
    } else {
      this._hooks.clear();
    }
  }

  /**
   * Destroy this engine. All hooks are cleared.
   */
  destroy(): void {
    this._hooks.clear();
    this._destroyed = true;
  }

  // --- Private helpers ---

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('HookEngine has been destroyed');
    }
  }
}
