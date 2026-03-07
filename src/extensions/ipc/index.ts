/**
 * @module ipc
 * @layer L2 — extensions barrel export
 *
 * Inter-process communication: wire protocol, Unix socket server, message router.
 */

export type {
  IpcMessage,
  IpcRequest,
  IpcResponse,
  IpcNotification,
} from './protocol.js';
export {
  serializeMessage,
  deserializeMessage,
  buildRequest,
  buildResponse,
  buildNotification,
} from './protocol.js';

export type { IpcHandler } from './router.js';
export { IpcRouter } from './router.js';

export { IpcSocketServer } from './socket.js';
