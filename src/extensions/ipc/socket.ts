/**
 * @module ipc/socket
 * @layer L2 — extensions, depends on L1 core
 *
 * Unix domain socket IPC server.
 *
 * Accepts connections from other processes (e.g. CLI clients, test harnesses),
 * reads NDJSON-framed IpcMessage objects, routes them to the IpcRouter, and
 * writes IpcResponse objects back to the originating connection.
 */

import { createServer } from 'node:net';
import type { Server, Socket } from 'node:net';
import { unlink, access } from 'node:fs/promises';
import { EventBus } from '../../core/event-bus.js';
import {
  deserializeMessage,
  serializeMessage,
  buildResponse,
} from './protocol.js';
import type { IpcMessage, IpcRequest, IpcResponse } from './protocol.js';
import type { IpcRouter } from './router.js';

// JSON-RPC 2.0 standard error codes
const RPC_PARSE_ERROR = -32700;
const RPC_INTERNAL_ERROR = -32603;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Tracks per-connection state */
interface ConnectionState {
  readonly socket: Socket;
  /** Incomplete line buffer for NDJSON framing */
  buffer: string;
}

// ---------------------------------------------------------------------------
// IpcSocketServer
// ---------------------------------------------------------------------------

/**
 * Unix domain socket IPC server.
 *
 * @example
 * ```typescript
 * const server = new IpcSocketServer(eventBus, router);
 * await server.start('/tmp/gv.sock');
 * // later:
 * await server.stop();
 * ```
 */
export class IpcSocketServer {
  private readonly _eventBus: EventBus;
  private readonly _router: IpcRouter;
  private _server: Server | null = null;
  private _socketPath: string | null = null;

  constructor(eventBus: EventBus, router: IpcRouter) {
    this._eventBus = eventBus;
    this._router = router;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Start listening on a Unix domain socket at the given path.
   *
   * If a stale socket file exists at `socketPath`, it is removed before binding.
   *
   * @throws If the server fails to bind.
   */
  async start(socketPath: string): Promise<void> {
    if (this._server) {
      throw new Error('IpcSocketServer is already running');
    }

    // Remove stale socket file if it exists
    await this._removeStaleSocket(socketPath);

    await this._bind(socketPath);
    this._socketPath = socketPath;
  }

  /**
   * Stop the server and close all open connections.
   * Removes the socket file after closing.
   */
  async stop(): Promise<void> {
    if (!this._server) {
      return;
    }

    await new Promise<void>((resolve) => {
      this._server!.close(() => resolve());
    });

    this._server = null;

    if (this._socketPath) {
      await unlink(this._socketPath).catch(() => {
        // Ignore — already gone
      });
      this._socketPath = null;
    }
  }

  /** Returns true if the socket server is currently listening. */
  get isRunning(): boolean {
    return this._server !== null && this._server.listening;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async _removeStaleSocket(socketPath: string): Promise<void> {
    try {
      await access(socketPath);
      await unlink(socketPath);
    } catch {
      // File doesn't exist — nothing to remove
    }
  }

  private _bind(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer();

      server.on('connection', (socket: Socket) => {
        this._handleConnection(socket);
      });

      server.once('error', reject);

      server.listen(socketPath, () => {
        this._server = server;
        resolve();
      });
    });
  }

  private _handleConnection(socket: Socket): void {
    const state: ConnectionState = { socket, buffer: '' };

    this._eventBus.emit('ipc:connected', {
      remoteAddress: socket.remoteAddress ?? 'unix',
    });

    const decoder = new TextDecoder('utf-8', { fatal: true });

    socket.on('data', (chunk: Buffer | string) => {
      let text: string;
      try {
        text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
      } catch {
        // Malformed UTF-8 sequence — reject the connection
        this._eventBus.emit('ipc:error', {
          remoteAddress: socket.remoteAddress ?? 'unix',
          error: 'Malformed UTF-8 sequence in incoming data',
        });
        socket.destroy(new Error('Malformed UTF-8 sequence'));
        return;
      }
      this._handleData(state, text);
    });

    socket.on('close', () => {
      this._eventBus.emit('ipc:disconnected', {
        remoteAddress: socket.remoteAddress ?? 'unix',
      });
    });

    socket.on('error', (err) => {
      this._eventBus.emit('ipc:disconnected', {
        remoteAddress: socket.remoteAddress ?? 'unix',
        error: err.message,
      });
      socket.destroy();
    });
  }

  private _handleData(state: ConnectionState, chunk: string): void {
    state.buffer += chunk;

    // Process all complete NDJSON lines
    let newlineIdx: number;
    while ((newlineIdx = state.buffer.indexOf('\n')) !== -1) {
      const line = state.buffer.slice(0, newlineIdx);
      state.buffer = state.buffer.slice(newlineIdx + 1);

      if (line.trim().length === 0) continue;

      this._processLine(state.socket, line);
    }
  }

  private _processLine(socket: Socket, line: string): void {
    let message: IpcMessage;

    try {
      message = deserializeMessage(line);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const response: IpcResponse = buildResponse(
        null,
        null,
        { code: RPC_PARSE_ERROR, message: `Parse error: ${errMsg}` },
      );
      this._sendResponse(socket, response);
      return;
    }

    this._eventBus.emit('ipc:message', { message });

    // Only route request messages; notifications are fire-and-forget
    if (message.type !== 'request') {
      return;
    }

    const request = message as IpcRequest;

    this._router.route(request).then(
      (response) => {
        this._sendResponse(socket, response);
      },
      (err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        const response: IpcResponse = buildResponse(
          request.id,
          null,
          { code: RPC_INTERNAL_ERROR, message: errMsg },
        );
        this._sendResponse(socket, response);
      },
    );
  }

  private _sendResponse(socket: Socket, response: IpcResponse): void {
    if (socket.writable) {
      socket.write(serializeMessage(response));
    }
  }
}
