/**
 * @module ipc/router
 * @layer L2 — extensions, depends on L1 core
 *
 * IPC message router. Dispatches incoming IpcRequests to registered handlers
 * by `method` name and returns correlated IpcResponse objects.
 *
 * Built-in handlers:
 * - `ping`   → responds `pong` with the original payload
 * - `status` → responds with a basic runtime status snapshot
 */

import { EventBus } from '../../core/event-bus.js';
import {
  buildResponse,
} from './protocol.js';
import type { IpcRequest, IpcResponse } from './protocol.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Handler function for a named IPC method */
export type IpcHandler = (
  request: IpcRequest,
) => Promise<unknown> | unknown;

// ---------------------------------------------------------------------------
// IpcRouter
// ---------------------------------------------------------------------------

/**
 * Internal runtime IPC router for inter-process communication.
 *
 * This router serves internal runtime messages (ping, status, etc.) between
 * daemon processes. It does NOT handle ACP protocol methods (initialize,
 * session/new, session/prompt, etc.) — those are routed by the SDK's
 * AgentSideConnection which delegates to the Agent interface (GoodVibesAgent).
 *
 * To add ACP method proxying (e.g., for a daemon→agent gateway), register
 * handlers that forward to GoodVibesAgent via the AgentSideConnection.
 */
export class IpcRouter {
  private readonly _eventBus: EventBus;
  private readonly _handlers = new Map<string, IpcHandler>();
  private _idCounter = 0;

  constructor(eventBus: EventBus) {
    this._eventBus = eventBus;
    this._registerBuiltIns();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Register a handler for a named IPC method.
   *
   * If a handler is already registered for the given `type`, it is replaced.
   *
   * @param type    The method name (e.g. 'ping', 'status')
   * @param handler Function that receives the full IpcRequest and returns
   *                a response payload (sync or async).
   */
  register(type: string, handler: IpcHandler): void {
    this._handlers.set(type, handler);
  }

  /**
   * Route an IpcRequest to its registered handler and return a correlated
   * IpcResponse.
   *
   * If no handler is registered for `request.method`, returns an error response.
   *
   * @throws Never — all errors are captured and returned as error IpcResponse.
   */
  async route(request: IpcRequest): Promise<IpcResponse> {
    const handler = this._handlers.get(request.method);
    const responseId = this._nextId();

    if (!handler) {
      return buildResponse(
        responseId,
        request.id,
        false,
        null,
        `Unknown method: ${request.method}`,
      );
    }

    try {
      const result = await handler(request);
      return buildResponse(responseId, request.id, true, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return buildResponse(responseId, request.id, false, null, message);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: built-in handlers
  // ---------------------------------------------------------------------------

  private _registerBuiltIns(): void {
    // ping → pong: echo the payload back
    this.register('ping', (req) => ({
      pong: true,
      echo: req.payload,
      timestamp: Date.now(),
    }));

    // status → runtime status snapshot
    this.register('status', () => ({
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      handlerCount: this._eventBus.handlerCount,
      timestamp: Date.now(),
    }));
  }

  private _nextId(): string {
    return `ipc_r_${Date.now()}_${++this._idCounter}`;
  }
}
