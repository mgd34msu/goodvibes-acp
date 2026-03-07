/**
 * @module acp
 * @layer L2 — ACP protocol layer barrel export
 */

export { GoodVibesAgent } from './agent.js';
export { AcpFileSystem } from './fs-bridge.js';
export { AcpTerminal } from './terminal-bridge.js';
export {
  buildConfigOptions,
  modeFromConfigValue,
  CONFIG_ID_MODE,
  CONFIG_ID_MODEL,
} from './config-adapter.js';
export type { GoodVibesMode } from './config-adapter.js';
export { ACP_ERROR_CODES, toAcpError } from './errors.js';
export type { AcpErrorCode, AcpErrorShape } from './errors.js';
export { createTransport, createStdioTransport } from './transport.js';
export type { StdioTransportOptions, TcpTransportOptions, WebSocketTransportOptions, TransportOptions, AcpStream } from './transport.js';
export { SessionAdapter } from './session-adapter.js';
export { GoodVibesExtensions } from './extensions.js';
export { EventRecorder } from './event-recorder.js';
export type { RecordedEvent } from './event-recorder.js';
export { PermissionGate, MODE_POLICIES } from './permission-gate.js';
export type { PermissionRequest, PermissionResult, PermissionPolicy, PermissionType } from './permission-gate.js';
export { PlanEmitter } from './plan-emitter.js';
export { CommandsEmitter } from './commands-emitter.js';
