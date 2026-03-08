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

// JSON-RPC 2.0 standard error codes
const RPC_METHOD_NOT_FOUND = -32601;
const RPC_INTERNAL_ERROR = -32603;

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
   * If a handler is already registered for the given `routeMethod`, it is replaced.
   *
   * @param routeMethod The method name (e.g. 'ping', 'status')
   * @param handler     Function that receives the full IpcRequest and returns
   *                    a response payload (sync or async).
   */
  register(routeMethod: string, handler: IpcHandler): void {
    this._handlers.set(routeMethod, handler);
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

    if (!handler) {
      return buildResponse(
        request.id,
        null,
        { code: RPC_METHOD_NOT_FOUND, message: `Unknown method: ${request.method}` },
      );
    }

    try {
      const result = await handler(request);
      return buildResponse(request.id, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return buildResponse(request.id, null, { code: RPC_INTERNAL_ERROR, message });
    }
  }

  // ---------------------------------------------------------------------------
  // Private: built-in handlers
  // ---------------------------------------------------------------------------

  private _registerBuiltIns(): void {
    // ping → pong: echo the params back
    this.register('ping', (req) => ({
      pong: true,
      echo: req.params,
    }));

    // status → runtime status snapshot
    this.register('status', () => ({
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      handlerCount: this._eventBus?.handlerCount ?? 0,
    }));
  }
}
