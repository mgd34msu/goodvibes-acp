/**
 * state-machine.ts — Generic finite state machine
 *
 * L1 Core — imports only from L0 types and Bun/Node std lib.
 * Zero external npm dependencies.
 */

import type { Disposable } from './event-bus.js';

/** A single state's configuration */
export interface StateConfig<TContext> {
  /** Optional action called when entering this state */
  onEnter?: (context: TContext, from: string) => void | Promise<void>;
  /** Optional action called when leaving this state */
  onExit?: (context: TContext, to: string) => void | Promise<void>;
}

/** A transition definition between states */
export interface TransitionConfig<TState extends string, TContext> {
  /** Source state (or array of states) */
  from: TState | TState[];
  /** Target state */
  to: TState;
  /** Event name that triggers this transition */
  event: string;
  /** Optional guard — transition only fires if this returns true */
  guard?: (context: TContext) => boolean;
}

/** Full configuration for a StateMachine */
export interface StateMachineConfig<TState extends string, TContext> {
  /** Initial state */
  initial: TState;
  /** State definitions */
  states: Partial<Record<TState, StateConfig<TContext>>>;
  /** Transition definitions */
  transitions: TransitionConfig<TState, TContext>[];
  /** Initial context data */
  context: TContext;
  /** Maximum number of transition records to keep in history (default: 100) */
  historyLimit?: number;
}

/** A record of a state transition */
export interface TransitionRecord<TState extends string> {
  /** Transition event that fired */
  event: string;
  /** State before the transition */
  from: TState;
  /** State after the transition */
  to: TState;
  /** Timestamp of the transition */
  timestamp: number;
}

/** Serialized state machine for persistence */
export interface SerializedStateMachine<TState extends string, TContext> {
  /** Schema version */
  $schema: string;
  /** Current state */
  current: TState;
  /** Context data */
  context: TContext;
  /** Transition history */
  history: TransitionRecord<TState>[];
  /** Timestamp of serialization */
  timestamp: string;
}

/** Callback fired on every state transition */
export type TransitionHandler<TState extends string, TContext> = (
  record: TransitionRecord<TState>,
  context: TContext
) => void | Promise<void>;

/** Callback fired when entering a specific state */
export type StateEnterHandler<TContext> = (
  from: string,
  context: TContext
) => void | Promise<void>;

/** Callback fired when leaving a specific state */
export type StateExitHandler<TContext> = (
  to: string,
  context: TContext
) => void | Promise<void>;

const STATE_MACHINE_SCHEMA_VERSION = '1.0.0';

/**
 * Generic finite state machine.
 *
 * Features:
 * - Type-safe states and events (string literal types)
 * - Transition guards (conditional transitions)
 * - onEnter/onExit hooks per state
 * - onTransition listener for any transition
 * - Transition history tracking
 * - Serializable state + context for persistence
 * - NO domain knowledge — just states and transitions
 *
 * @example
 * ```typescript
 * const machine = new StateMachine({
 *   initial: 'idle',
 *   states: { idle: {}, working: {}, done: {} },
 *   transitions: [
 *     { from: 'idle', to: 'working', event: 'start' },
 *     { from: 'working', to: 'done', event: 'finish' },
 *   ],
 *   context: { attempts: 0 },
 * });
 * machine.transition('start'); // true
 * machine.current(); // 'working'
 * ```
 */
export class StateMachine<TState extends string, TContext> {
  private _current: TState;
  private _context: TContext;
  private readonly _config: StateMachineConfig<TState, TContext>;
  private readonly _history: TransitionRecord<TState>[] = [];
  private readonly _transitionHandlers = new Set<TransitionHandler<TState, TContext>>();
  private readonly _enterHandlers = new Map<TState, Set<StateEnterHandler<TContext>>>();
  private readonly _exitHandlers = new Map<TState, Set<StateExitHandler<TContext>>>();
  private readonly _historyLimit: number;

  constructor(config: StateMachineConfig<TState, TContext>) {
    this._config = config;
    this._current = config.initial;
    this._context = { ...config.context };
    this._historyLimit = config.historyLimit ?? 100;
  }

  /**
   * Attempt a state transition using the given event name.
   * Checks all transitions where `from` matches current state and `event` matches.
   * If a guard is defined, it must return true.
   *
   * @param event - Event name to trigger
   * @returns true if a transition occurred, false if no valid transition found
   */
  transition(event: string): boolean {
    const validTransitions = this._config.transitions.filter((t) => {
      const fromMatches = Array.isArray(t.from)
        ? t.from.includes(this._current)
        : t.from === this._current;
      return fromMatches && t.event === event;
    });

    for (const t of validTransitions) {
      // Check guard
      if (t.guard && !t.guard(this._context)) {
        continue;
      }

      // Run onExit for current state
      const exitConfig = this._config.states[this._current];
      if (exitConfig?.onExit) {
        try {
          const result = exitConfig.onExit(this._context, t.to);
          // Sync — we don't await hooks to keep transition atomic
          if (result instanceof Promise) {
            result.catch((err: unknown) => { console.error('[StateMachine] hook error:', err); });
          }
        } catch (err: unknown) { console.error('[StateMachine] hook error:', err); }
      }

      // Fire exit handlers
      const exitHandlers = this._exitHandlers.get(this._current);
      if (exitHandlers) {
        for (const handler of exitHandlers) {
          try {
            const result = handler(t.to, this._context);
            if (result instanceof Promise) {
              result.catch((err: unknown) => { console.error('[StateMachine] hook error:', err); });
            }
          } catch (err: unknown) { console.error('[StateMachine] hook error:', err); }
        }
      }

      const from = this._current;
      this._current = t.to;

      // Run onEnter for new state
      const enterConfig = this._config.states[this._current];
      if (enterConfig?.onEnter) {
        try {
          const result = enterConfig.onEnter(this._context, from);
          if (result instanceof Promise) {
            result.catch((err: unknown) => { console.error('[StateMachine] hook error:', err); });
          }
        } catch (err: unknown) { console.error('[StateMachine] hook error:', err); }
      }

      // Fire enter handlers
      const enterHandlers = this._enterHandlers.get(this._current);
      if (enterHandlers) {
        for (const handler of enterHandlers) {
          try {
            const result = handler(from, this._context);
            if (result instanceof Promise) {
              result.catch((err: unknown) => { console.error('[StateMachine] hook error:', err); });
            }
          } catch (err: unknown) { console.error('[StateMachine] hook error:', err); }
        }
      }

      // Record transition
      const record: TransitionRecord<TState> = {
        event,
        from,
        to: this._current,
        timestamp: Date.now(),
      };
      this._history.push(record);
      if (this._history.length > this._historyLimit) {
        this._history.shift();
      }

      // Notify transition handlers
      for (const handler of this._transitionHandlers) {
        try {
          const result = handler(record, this._context);
          if (result instanceof Promise) {
            result.catch((err: unknown) => { console.error('[StateMachine] hook error:', err); });
          }
        } catch (err: unknown) { console.error('[StateMachine] hook error:', err); }
      }

      return true;
    }

    return false;
  }

  /**
   * Check if the given event would produce a valid transition from the current state.
   * Does NOT fire guards.
   *
   * @param event - Event name to check
   * @returns true if at least one transition matches (regardless of guards)
   */
  can(event: string): boolean {
    return this._config.transitions.some((t) => {
      const fromMatches = Array.isArray(t.from)
        ? t.from.includes(this._current)
        : t.from === this._current;
      return fromMatches && t.event === event;
    });
  }

  /**
   * Get the current state.
   *
   * @returns Current state string
   */
  current(): TState {
    return this._current;
  }

  /**
   * Get the current context.
   * Returns a reference — mutate via updateContext() to ensure change tracking.
   *
   * @returns Current context object
   */
  context(): TContext {
    return this._context;
  }

  /**
   * Update the context data.
   * The updater receives the current context and returns an updated copy.
   *
   * @param updater - Function that receives current context and returns new context
   */
  updateContext(updater: (context: TContext) => TContext): void {
    this._context = updater(this._context);
  }

  /**
   * Register a callback that fires on every state transition.
   *
   * @param handler - Transition callback
   * @returns Disposable to unsubscribe
   */
  onTransition(handler: TransitionHandler<TState, TContext>): Disposable {
    this._transitionHandlers.add(handler);
    return {
      dispose: () => this._transitionHandlers.delete(handler),
    };
  }

  /**
   * Register a callback that fires when entering a specific state.
   *
   * @param state - Target state to watch
   * @param handler - Enter callback
   * @returns Disposable to unsubscribe
   */
  onEnter(state: TState, handler: StateEnterHandler<TContext>): Disposable {
    if (!this._enterHandlers.has(state)) {
      this._enterHandlers.set(state, new Set());
    }
    this._enterHandlers.get(state)!.add(handler);
    return {
      dispose: () => this._enterHandlers.get(state)?.delete(handler),
    };
  }

  /**
   * Register a callback that fires when leaving a specific state.
   *
   * @param state - Source state to watch
   * @param handler - Exit callback
   * @returns Disposable to unsubscribe
   */
  onExit(state: TState, handler: StateExitHandler<TContext>): Disposable {
    if (!this._exitHandlers.has(state)) {
      this._exitHandlers.set(state, new Set());
    }
    this._exitHandlers.get(state)!.add(handler);
    return {
      dispose: () => this._exitHandlers.get(state)?.delete(handler),
    };
  }

  /**
   * Get the transition history.
   *
   * @returns Array of transition records (oldest first)
   */
  history(): TransitionRecord<TState>[] {
    return [...this._history];
  }

  /**
   * Reset the machine to its initial state and context.
   * Clears history and removes no listeners.
   */
  reset(): void {
    this._current = this._config.initial;
    this._context = { ...this._config.context };
    this._history.length = 0;
  }

  /**
   * Serialize the state machine for persistence.
   *
   * @returns Serialized state machine
   */
  serialize(): SerializedStateMachine<TState, TContext> {
    return {
      $schema: STATE_MACHINE_SCHEMA_VERSION,
      current: this._current,
      context: { ...this._context },
      history: [...this._history],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Restore a state machine from serialized data.
   * Creates a new machine with the given config and restores state.
   *
   * @param config - State machine configuration
   * @param data - Serialized data from serialize()
   * @returns Restored StateMachine instance
   */
  static restore<TState extends string, TContext>(
    config: StateMachineConfig<TState, TContext>,
    data: SerializedStateMachine<TState, TContext>
  ): StateMachine<TState, TContext> {
    const machine = new StateMachine(config);
    machine._current = data.current;
    machine._context = data.context;
    machine._history.push(...data.history);
    return machine;
  }
}
