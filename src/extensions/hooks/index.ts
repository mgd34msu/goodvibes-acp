/**
 * @module extensions/hooks
 * @layer L2 — extensions
 *
 * Barrel export for the hooks module.
 * Provides HookRegistrar for pre-registering GoodVibes built-in hooks.
 */

export { HookRegistrar } from './registrar.js';
export { validateAgentConfig, emitAgentSpawned, emitWrfcReviewScore, emitWrfcCompleted, emitSessionCreated, emitSessionDestroyed } from './built-ins.js';
