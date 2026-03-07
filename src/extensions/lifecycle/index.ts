/**
 * @module lifecycle
 * @layer L2 — extensions
 *
 * Lifecycle management: graceful shutdown and runtime health checks.
 */

export { ShutdownManager, SHUTDOWN_ORDER } from './shutdown.js';
export { HealthCheck } from './health.js';
export type { HealthStatus } from './health.js';
