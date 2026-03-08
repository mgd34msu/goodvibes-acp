/**
 * index.ts — Barrel export for L1 Core modules
 *
 * L1 Core layer. Import from this file for clean access to all L1 primitives.
 *
 * @example
 * ```typescript
 * import { EventBus, StateStore, Registry, Queue } from '@l1/index';
 * // or relative:
 * import { EventBus, StateStore, Registry, Queue } from '../core/index.js';
 * ```
 */

// Event system
export type {
  EventRecord,
  EventHandler,
  EventPredicate,
  Disposable,
  EventBusOptions,
} from './event-bus.js';
export { EventBus } from './event-bus.js';

// State store
export type {
  SerializedNamespace,
  SerializedState,
  StateChangeEvent,
  StateChangeCallback,
} from './state-store.js';
export { StateStore } from './state-store.js';

// State machine
export type {
  StateConfig,
  TransitionConfig,
  StateMachineConfig,
  TransitionRecord,
  SerializedStateMachine,
  TransitionHandler,
  StateEnterHandler,
  StateExitHandler,
} from './state-machine.js';
export { StateMachine } from './state-machine.js';

// Configuration
export type {
  RuntimeConfig,
  ValidationResult,
  ConfigChangeCallback,
} from './config.js';
export { Config } from './config.js';

// Registry
export { Registry } from './registry.js';

// Trigger engine
// Note: TriggerDefinition, TriggerContext (L0), and ITriggerHandler (L0) are re-exported here
// as a convenience so consumers can import everything trigger-related from 'src/core' without
// also importing directly from 'src/types'. L1 may depend on L0; this is intentional.
export type { TriggerDefinition, TriggerContext } from '../types/trigger.js';
export type { ITriggerHandler } from '../types/registry.js';
export type { TriggerDefinitionWithCondition } from './trigger-engine.js';
export { TriggerEngine } from './trigger-engine.js';

// Queue
export type { SerializedQueue } from './queue.js';
export { Queue } from './queue.js';

// Scheduler
export type {
  ScheduleConfig,
  TaskStatus,
  ScheduledTask,
} from './scheduler.js';
export { Scheduler } from './scheduler.js';

// Hook engine
export type {
  HookPhase,
  PreHookHandler,
  PostHookHandler,
  HookRegistration,
} from './hook-engine.js';
export { HookEngine } from './hook-engine.js';

// Versioned store
export type { VersionedData } from './versioned-store.js';
export { wrapVersioned, unwrapVersioned, isVersioned } from './versioned-store.js';
