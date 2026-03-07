/**
 * trigger-engine.ts — Condition → action evaluation engine
 *
 * L1 Core — imports only from L0 types and Bun/Node std lib.
 * Zero external npm dependencies.
 */

import type { EventBus, EventRecord, Disposable } from './event-bus.js';
import type { Registry } from './registry.js';

/**
 * A trigger definition that maps event conditions to handler actions.
 * Imported from L0 trigger types once available.
 * Replace with: import type { TriggerDefinition, TriggerContext } from '../types/trigger.js';
 */
export interface TriggerDefinition {
  /** Unique trigger identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Event type pattern to match:
   * - Exact: 'session:started'
   * - Wildcard: 'session:*' matches any event starting with 'session:'
   * - All: '*' matches every event
   * - Regex: '/pattern/' (string starting and ending with '/')
   */
  eventPattern: string;
  /** Optional additional condition on the event payload */
  condition?: (event: EventRecord) => boolean;
  /** Registry key for the ITriggerHandler implementation */
  handlerKey: string;
  /** Whether the trigger is currently enabled (default: true) */
  enabled?: boolean;
  /** Maximum number of times to fire (undefined = unlimited) */
  maxFires?: number;
  /** Session ID to scope to (undefined = all sessions) */
  sessionId?: string;
  /** Additional metadata passed to the handler */
  metadata?: Record<string, unknown>;
}

/**
 * Context passed to trigger handlers when a trigger fires.
 */
export interface TriggerContext {
  /** The trigger that fired */
  trigger: TriggerDefinition;
  /** The event that caused the trigger to fire */
  event: EventRecord;
  /** Number of times this trigger has fired (including this one) */
  fireCount: number;
}

/**
 * Interface for trigger handler implementations (registered in L1 Registry).
 * Implemented by L3 plugins and registered at startup.
 * Replace with: import type { ITriggerHandler } from '../types/registry.js';
 */
export interface ITriggerHandler {
  /** Check if this handler can process the given trigger */
  canHandle(trigger: TriggerDefinition): boolean;
  /** Execute the trigger action */
  execute(trigger: TriggerDefinition, context: TriggerContext): Promise<void>;
}

/** Internal tracking state for a registered trigger */
interface TriggerState {
  definition: TriggerDefinition;
  fireCount: number;
  enabled: boolean;
}

/**
 * Check if an event type matches a trigger pattern.
 */
function matchesPattern(eventType: string, pattern: string): boolean {
  // Exact match
  if (pattern === eventType) return true;
  // Wildcard all
  if (pattern === '*') return true;
  // Regex pattern: /pattern/
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
    const regexStr = pattern.slice(1, -1);
    try {
      return new RegExp(regexStr).test(eventType);
    } catch {
      return false;
    }
  }
  // Prefix wildcard: 'session:*'
  if (pattern.endsWith(':*')) {
    return eventType.startsWith(pattern.slice(0, -1));
  }
  // Suffix wildcard: '*:completed'
  if (pattern.startsWith('*:')) {
    return eventType.endsWith(pattern.slice(1));
  }
  return false;
}

/**
 * Condition → action evaluation engine.
 *
 * Features:
 * - Subscribes to the EventBus and evaluates all registered triggers on each event
 * - Pattern matching on event type (exact, wildcard prefix/suffix, regex)
 * - Optional payload condition functions
 * - Fire count tracking with maxFires limit
 * - Enable/disable individual triggers
 * - Error isolation: a failing trigger handler does not affect others
 * - Handler lookup via registry.get<ITriggerHandler>(handlerKey)
 *
 * @example
 * ```typescript
 * const engine = new TriggerEngine(eventBus, registry);
 * engine.register({
 *   id: 'on-agent-complete',
 *   name: 'Handle agent completion',
 *   eventPattern: 'agent:completed',
 *   handlerKey: 'wrfc-handler',
 *   maxFires: undefined,
 * });
 * ```
 */
export class TriggerEngine {
  private readonly _triggers = new Map<string, TriggerState>();
  private readonly _subscription: Disposable;
  private _destroyed = false;

  /**
   * Create a TriggerEngine.
   *
   * @param eventBus - The L1 EventBus to subscribe to
   * @param registry - The L1 Registry for looking up ITriggerHandler implementations
   */
  constructor(
    private readonly _eventBus: EventBus,
    private readonly _registry: Registry
  ) {
    // Subscribe to all events via wildcard
    this._subscription = this._eventBus.on('*', (event: EventRecord) => {
      this.evaluate(event);
    });
  }

  /**
   * Register a trigger definition.
   *
   * @param trigger - Trigger to register
   * @throws Error if a trigger with the same id is already registered
   */
  register(trigger: TriggerDefinition): void {
    this._assertNotDestroyed();
    if (this._triggers.has(trigger.id)) {
      throw new Error(`TriggerEngine: trigger '${trigger.id}' is already registered`);
    }
    this._triggers.set(trigger.id, {
      definition: trigger,
      fireCount: 0,
      enabled: trigger.enabled !== false,
    });
  }

  /**
   * Unregister a trigger by ID.
   *
   * @param triggerId - ID of the trigger to remove
   */
  unregister(triggerId: string): void {
    this._triggers.delete(triggerId);
  }

  /**
   * Enable a previously disabled trigger.
   *
   * @param triggerId - ID of the trigger to enable
   */
  enable(triggerId: string): void {
    const state = this._triggers.get(triggerId);
    if (state) state.enabled = true;
  }

  /**
   * Disable a trigger without removing it.
   * Disabled triggers will not fire even if their conditions match.
   *
   * @param triggerId - ID of the trigger to disable
   */
  disable(triggerId: string): void {
    const state = this._triggers.get(triggerId);
    if (state) state.enabled = false;
  }

  /**
   * Evaluate all registered triggers against an event.
   * Called automatically when an event is emitted on the bus.
   * Can also be called directly for testing.
   *
   * @param event - Event record to evaluate
   */
  evaluate(event: EventRecord): void {
    if (this._destroyed) return;

    for (const state of this._triggers.values()) {
      if (!state.enabled) continue;

      const { definition } = state;

      // Check maxFires limit
      if (definition.maxFires !== undefined && state.fireCount >= definition.maxFires) {
        continue;
      }

      // Check session scope
      if (
        definition.sessionId !== undefined &&
        (event.payload as Record<string, unknown>)?.sessionId !== definition.sessionId
      ) {
        continue;
      }

      // Check event pattern
      if (!matchesPattern(event.type, definition.eventPattern)) {
        continue;
      }

      // Check payload condition
      if (definition.condition && !definition.condition(event)) {
        continue;
      }

      // Increment fire count
      state.fireCount++;

      // Look up handler
      const handler = this._registry.getOptional<ITriggerHandler>(definition.handlerKey);
      if (!handler) {
        // No handler registered — skip silently (handler may not be loaded yet)
        continue;
      }

      // Check handler capability
      if (!handler.canHandle(definition)) {
        continue;
      }

      // Execute handler with error isolation
      const context: TriggerContext = {
        trigger: definition,
        event,
        fireCount: state.fireCount,
      };

      handler.execute(definition, context).catch((err: unknown) => {
        // Emit error to bus but don't crash the engine
        this._eventBus.emit('error', {
          source: 'trigger-engine',
          triggerId: definition.id,
          error: err instanceof Error ? err : new Error(String(err)),
          timestamp: Date.now(),
        });
      });
    }
  }

  /**
   * List all registered trigger definitions.
   *
   * @returns Array of trigger definitions
   */
  list(): TriggerDefinition[] {
    return Array.from(this._triggers.values()).map((s) => s.definition);
  }

  /**
   * Get a specific trigger definition by ID.
   *
   * @param triggerId - Trigger ID
   * @returns Trigger definition, or undefined if not found
   */
  get(triggerId: string): TriggerDefinition | undefined {
    return this._triggers.get(triggerId)?.definition;
  }

  /**
   * Get the fire count for a specific trigger.
   *
   * @param triggerId - Trigger ID
   * @returns Number of times the trigger has fired, or 0 if not found
   */
  getFireCount(triggerId: string): number {
    return this._triggers.get(triggerId)?.fireCount ?? 0;
  }

  /**
   * Destroy this engine. The EventBus subscription is removed.
   * All registered triggers are cleared.
   */
  destroy(): void {
    this._subscription.dispose();
    this._triggers.clear();
    this._destroyed = true;
  }

  // --- Private helpers ---

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('TriggerEngine has been destroyed');
    }
  }
}
