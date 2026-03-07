/**
 * built-ins.ts — Built-in hook handler functions
 *
 * L2 Extensions — standalone, testable hook handlers.
 * Each function is exported independently and used by HookRegistrar.
 */

import type { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// HookContext
// ---------------------------------------------------------------------------

/**
 * Typed context object passed to all built-in hook handlers.
 * Extensible via the index signature while keeping well-known fields typed.
 */
export interface HookContext {
  event: string;
  timestamp: number;
  sessionId?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Pre-hook handlers
// ---------------------------------------------------------------------------

/**
 * Validate agent config before spawning.
 * Returns proceed=false if required fields are missing.
 */
export function validateAgentConfig(
  context: HookContext
): { proceed: boolean; reason?: string } {
  const required = ['type', 'task', 'sessionId'] as const;
  for (const field of required) {
    if (context[field] === undefined || context[field] === null) {
      return { proceed: false, reason: `Missing required field: ${field}` };
    }
  }
  const config = context as Record<string, unknown>;
  if (!config['mode'] && !config['permissionPolicy']) {
    console.error('[Hooks] Warning: Agent spawned without permission context');
  }
  return { proceed: true };
}

// ---------------------------------------------------------------------------
// Post-hook handlers
// ---------------------------------------------------------------------------

/**
 * Emit agent:spawned event after a successful agent spawn.
 */
export function emitAgentSpawned(
  eventBus: EventBus,
  context: HookContext
): void {
  eventBus.emit('agent:spawned', context);
}

/**
 * Log review scores via EventBus after a wrfc:review completes.
 */
export function emitWrfcReviewScore(
  eventBus: EventBus,
  context: HookContext,
  result: unknown
): void {
  eventBus.emit('wrfc:review:score', { context, result });
}

/**
 * Emit wrfc:completed event after a WRFC cycle completes.
 */
export function emitWrfcCompleted(
  eventBus: EventBus,
  context: HookContext
): void {
  eventBus.emit('wrfc:completed', context);
}

/**
 * Emit session:created event after a session is created.
 */
export function emitSessionCreated(
  eventBus: EventBus,
  context: HookContext
): void {
  eventBus.emit('session:created', context);
}

/**
 * Emit session:destroyed event after a session is destroyed.
 */
export function emitSessionDestroyed(
  eventBus: EventBus,
  context: HookContext
): void {
  eventBus.emit('session:destroyed', context);
}
