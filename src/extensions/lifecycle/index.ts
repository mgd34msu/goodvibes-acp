/**
 * @module lifecycle
 * @layer L2 — extensions
 *
 * Lifecycle management: graceful shutdown, runtime health checks, and daemon mode.
 */

export { ShutdownManager, SHUTDOWN_ORDER } from './shutdown.js';
export { HealthCheck } from './health.js';
export type { HealthStatus } from './health.js';
export { DaemonManager } from './daemon.js';
export type { DaemonOptions } from './daemon.js';
