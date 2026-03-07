/**
 * @module wrfc
 * @layer L2 — extension built on L0 types and L1 core
 *
 * WRFC (Work → Review → Fix → Check) state machine and orchestrator.
 *
 * Usage:
 * ```typescript
 * import { createWRFCMachine, WRFCOrchestrator } from './extensions/wrfc/index.js';
 * ```
 */

export { createWRFCMachine, WRFC_EVENTS, WRFC_TERMINAL_STATES } from './machine.js';
export type { WRFCEvent } from './machine.js';
export { WRFCOrchestrator } from './orchestrator.js';
export type { WRFCCallbacks, WRFCRunParams } from './orchestrator.js';
