/**
 * built-ins.ts — Built-in hook handler functions
 *
 * L2 Extensions — standalone, testable hook handlers.
 * Each function is exported independently and used by HookRegistrar.
 */

import type { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// Pre-hook handlers
// ---------------------------------------------------------------------------

/**
 * Validate agent config before spawning.
 * Returns proceed=false if required fields are missing.
 */
export function validateAgentConfig(
  context: Record<string, unknown>
): { proceed: boolean; reason?: string } {
  const required = ['type', 'task', 'sessionId'] as const;
  for (const field of required) {
    if (context[field] === undefined || context[field] === null) {
      return { proceed: false, reason: `Missing required field: ${field}` };
    }
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
  context: Record<string, unknown>
): void {
  eventBus.emit('agent:spawned', context);
}

/**
 * Log review scores via EventBus after a wrfc:review completes.
 */
export function emitWrfcReviewScore(
  eventBus: EventBus,
  context: Record<string, unknown>,
  result: unknown
): void {
  eventBus.emit('wrfc:review:score', { context, result });
}

/**
 * Emit wrfc:completed event after a WRFC cycle completes.
 */
export function emitWrfcCompleted(
  eventBus: EventBus,
  context: Record<string, unknown>
): void {
  eventBus.emit('wrfc:completed', context);
}

/**
 * Emit session:created event after a session is created.
 */
export function emitSessionCreated(
  eventBus: EventBus,
  context: Record<string, unknown>
): void {
  eventBus.emit('session:created', context);
}

/**
 * Emit session:destroyed event after a session is destroyed.
 */
export function emitSessionDestroyed(
  eventBus: EventBus,
  context: Record<string, unknown>
): void {
  eventBus.emit('session:destroyed', context);
}
