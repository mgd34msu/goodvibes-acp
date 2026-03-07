/**
 * registrar.ts — Pre-registers GoodVibes built-in hooks into the L1 HookEngine
 *
 * L2 Extensions — imports from L1 core only.
 */

import { HookEngine } from '../../core/hook-engine.js';
import { EventBus } from '../../core/event-bus.js';
import {
  validateAgentConfig,
  emitAgentSpawned,
  emitWrfcReviewScore,
  emitWrfcCompleted,
  emitSessionCreated,
  emitSessionDestroyed,
} from './built-ins.js';

/**
 * HookRegistrar pre-registers all GoodVibes-specific hooks into the HookEngine at startup.
 *
 * @example
 * ```typescript
 * const registrar = new HookRegistrar(hookEngine, eventBus);
 * registrar.registerBuiltins();
 * ```
 */
export class HookRegistrar {
  private readonly _hookEngine: HookEngine;
  private readonly _eventBus: EventBus;

  constructor(hookEngine: HookEngine, eventBus: EventBus) {
    this._hookEngine = hookEngine;
    this._eventBus = eventBus;
  }

  /**
   * Register all built-in GoodVibes hooks.
   *
   * Registered hooks:
   * - agent:spawn pre  — validates agent config before spawning
   * - agent:spawn post — emits agent:spawned event
   * - wrfc:review post — logs review scores via EventBus
   * - wrfc:complete post — emits wrfc:completed event
   * - session:create post — emits session:created event
   * - session:destroy post — emits session:destroyed event
   */
  registerBuiltins(): void {
    const { _hookEngine: engine, _eventBus: bus } = this;

    // agent:spawn — pre: validate config
    engine.register(
      'agent:spawn',
      'pre',
      (context: Record<string, unknown>) => {
        const validation = validateAgentConfig(context);
        if (!validation.proceed) {
          // Return context with validation error metadata; engine continues
          return { ...context, _validationError: validation.reason };
        }
        return context;
      }
    );

    // agent:spawn — post: emit agent:spawned event
    engine.register(
      'agent:spawn',
      'post',
      (context: Record<string, unknown>) => {
        emitAgentSpawned(bus, context);
      }
    );

    // wrfc:review — post: log review scores
    engine.register(
      'wrfc:review',
      'post',
      (context: Record<string, unknown>, result: unknown) => {
        emitWrfcReviewScore(bus, context, result);
      }
    );

    // wrfc:complete — post: emit wrfc:completed event
    engine.register(
      'wrfc:complete',
      'post',
      (context: Record<string, unknown>) => {
        emitWrfcCompleted(bus, context);
      }
    );

    // session:create — post: emit session:created event
    engine.register(
      'session:create',
      'post',
      (context: Record<string, unknown>) => {
        emitSessionCreated(bus, context);
      }
    );

    // session:destroy — post: emit session:destroyed event
    engine.register(
      'session:destroy',
      'post',
      (context: Record<string, unknown>) => {
        emitSessionDestroyed(bus, context);
      }
    );
  }
}
