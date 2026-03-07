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
