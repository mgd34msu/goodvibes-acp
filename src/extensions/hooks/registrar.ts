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
  type HookContext,
} from './built-ins.js';
import type { PermissionGate } from '../acp/permission-gate.js';

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
  private readonly _permissionGate: PermissionGate | undefined;

  /**
   * @param hookEngine - The hook engine to register hooks into
   * @param eventBus - Event bus for emitting lifecycle events
   * @param permissionGate - Optional PermissionGate instance for tool execution gating (ISS-018)
   */
  constructor(hookEngine: HookEngine, eventBus: EventBus, permissionGate?: PermissionGate) {
    this._hookEngine = hookEngine;
    this._eventBus = eventBus;
    this._permissionGate = permissionGate;
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
    const { _hookEngine: engine, _eventBus: bus, _permissionGate: permissionGate } = this;

    // agent:spawn — pre: validate config
    // ISS-070: Sets _meta._abort: true and _meta._validationError on invalid configs.
    // Callers that invoke engine.execute('agent:spawn', ...) should check the returned
    // context for _meta._abort === true and abort the operation before proceeding.
    engine.register(
      'agent:spawn',
      'pre',
      (context: Record<string, unknown>) => {
        const validation = validateAgentConfig(context as HookContext);
        if (!validation.proceed) {
          // Store under _meta (ISS-019) and signal abort for callers to check (ISS-070)
          const existingMeta = (context._meta as Record<string, unknown> | undefined) ?? {};
          return {
            ...context,
            _meta: {
              ...existingMeta,
              _validationError: validation.reason,
              _abort: true,
            },
          };
        }
        return context;
      }
    );

    // agent:spawn — post: emit agent:spawned event
    engine.register(
      'agent:spawn',
      'post',
      (context: Record<string, unknown>) => {
        emitAgentSpawned(bus, context as HookContext);
      }
    );

    // wrfc:review — post: log review scores
    engine.register(
      'wrfc:review',
      'post',
      (context: Record<string, unknown>, result: unknown) => {
        emitWrfcReviewScore(bus, context as HookContext, result);
      }
    );

    // wrfc:complete — post: emit wrfc:completed event
    engine.register(
      'wrfc:complete',
      'post',
      (context: Record<string, unknown>) => {
        emitWrfcCompleted(bus, context as HookContext);
      }
    );

    // session:create — post: emit session:created event
    engine.register(
      'session:create',
      'post',
      (context: Record<string, unknown>) => {
        emitSessionCreated(bus, context as HookContext);
      }
    );

    // session:destroy — post: emit session:destroyed event
    engine.register(
      'session:destroy',
      'post',
      (context: Record<string, unknown>) => {
        emitSessionDestroyed(bus, context as HookContext);
      }
    );

    // tool:execute — pre: permission check (ISS-018, ISS-021)
    // Calls PermissionGate.check() when a gate is wired in. If permission is denied,
    // sets _meta._permissionDenied: true on the context. Callers should check this
    // flag and abort the tool call, emitting tool_call_update(status: 'failed').
    engine.register(
      'tool:execute',
      'pre',
      async (context: Record<string, unknown>) => {
        const existingMeta = (context._meta as Record<string, unknown> | undefined) ?? {};
        if (permissionGate) {
          // Build a PermissionRequest from the hook context
          const toolName = (context.toolName as string | undefined) ?? 'unknown';
          const permResult = await permissionGate.check({
            type: (context.permissionType as string | undefined) ?? 'mcp',
            toolCallId: context.toolCallId as string | undefined,
            toolName,
            title: `Execute tool: ${toolName}`,
            description: `Allow tool invocation: ${toolName}`,
            _meta: existingMeta,
          });
          if (!permResult.granted) {
            console.warn(
              `[HookRegistrar] Permission denied for tool '${toolName}':`,
              permResult.reason
            );
            return {
              ...context,
              _meta: {
                ...existingMeta,
                _permissionDenied: true,
                _permissionReason: permResult.reason,
              },
            };
          }
          return {
            ...context,
            _meta: { ...existingMeta, _permissionChecked: true },
          };
        }
        // No permission gate wired — log advisory and pass through
        // (ISS-015: PermissionGate not yet instantiated at construction time)
        console.warn(
          '[HookRegistrar] tool:execute pre-hook: no PermissionGate wired — skipping permission check'
        );
        return {
          ...context,
          _meta: { ...existingMeta, _permissionChecked: false, _permissionGateMissing: true },
        };
      },
      100
    );

    // tool:execute — post: emit tool_call_update (ISS-071)
    // Emits a 'tool:call:update' event on the EventBus with the completion status
    // and result, per ACP spec KB-05 step 6 and KB-06 tool_call_update schema.
    engine.register(
      'tool:execute',
      'post',
      (context: Record<string, unknown>, result: unknown) => {
        const toolCallId = context.toolCallId as string | undefined;
        const toolName = (context.toolName as string | undefined) ?? 'unknown';
        const meta = (context._meta as Record<string, unknown> | undefined) ?? {};
        const failed = Boolean(meta._permissionDenied);
        bus.emit('tool:call:update', {
          toolCallId,
          toolName,
          status: failed ? 'failed' : 'completed',
          output: result ?? null,
          reason: failed ? (meta._permissionReason as string | undefined) : undefined,
        });
      },
      100
    );
  }
}
