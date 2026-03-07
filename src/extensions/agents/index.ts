/**
 * @module extensions/agents
 * @layer L2 — extensions
 *
 * Barrel export for the agent tracking and coordination module.
 */

export { AgentTracker } from './tracker.js';
export type {
  AgentRegisteredPayload,
  AgentStatusChangedPayload,
  AgentCompletedPayload,
  AgentFailedPayload,
} from './tracker.js';

export { AgentCoordinator } from './coordinator.js';
export type { AgentCoordinatorOptions } from './coordinator.js';
