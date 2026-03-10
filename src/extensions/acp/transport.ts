/**
 * transport.ts — ACP transport abstraction
 *
 * L2 Extension — imports from L0 types and @agentclientprotocol/sdk.
 * Provides a factory function that creates ACP-compatible bidirectional
 * streams for different transport types.
 *
 * stdio transport — current implementation, used in main.ts
 * tcp       transport — hardened socket wrapper for daemon mode
 * websocket transport — client and server WebSocket implementations
 */

import { Readable, Writable } from 'node:stream';
import type { Socket } from 'node:net';
import * as acp from '@agentclientprotocol/sdk';
import type { TransportType } from '../../types/transport.js';

// Default protocol version injected when the client omits it (e.g. Zed editor)
const DEFAULT_PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// Transport options
// ---------------------------------------------------------------------------

/** Options for a stdio transport (no additional fields required) */
export type StdioTransportOptions = {
  type: 'stdio';
};

/** Options for a TCP transport (used to redirect to createTcpTransportFromSocket) */
export type TcpTransportOptions = {
  type: 'tcp';
  host?: string;
  port: number;
};

/** Options for a WebSocket transport (used to redirect to createWebSocketTransport) */
export type WebSocketTransportOptions = {
  type: 'websocket';
  host?: string;
  port: number;
  path?: string;
};

/** Union of all transport option shapes */
export type TransportOptions =
  | StdioTransportOptions
  | TcpTransportOptions
  | WebSocketTransportOptions;

// ---------------------------------------------------------------------------
// ACP stream type
// ---------------------------------------------------------------------------

/** The bidirectional stream accepted by AgentSideConnection */
export type AcpStream = ReturnType<typeof acp.ndJsonStream>;

// ---------------------------------------------------------------------------
// createTransport — factory
// ---------------------------------------------------------------------------

/**
 * Create an ACP-compatible bidirectional stream for the given transport type.
 *
 * NOTE: TCP and WebSocket types are intentionally unsupported here.
 * - TCP: use `createTcpTransportFromSocket(socket)` with the DaemonManager pattern.
 * - WebSocket: use `createWebSocketTransport(url)` for client mode, or
 *   `createWebSocketServerStream(ws)` for server mode.
 *
 * @param options - Transport configuration
 * @returns An ACP ndJson stream suitable for use with AgentSideConnection
 *
 * @throws Error when a non-stdio transport type is requested
 *
 * @example
 * ```typescript
 * const stream = createTransport({ type: 'stdio' });
 * const conn = new acp.AgentSideConnection(agentFactory, stream);
 * ```
 */
export function createTransport(options: TransportOptions): AcpStream {
  switch (options.type) {
    case 'stdio':
      return _createStdioTransport();

    case 'tcp':
      return _createTcpTransport(options);

    case 'websocket':
      return _createWebSocketTransportStub(options);

    default: {
      // Exhaustiveness check — TypeScript will error if a case is missing
      const _exhaustive: never = options;
      throw new Error(`Unknown transport type: ${(_exhaustive as TransportOptions).type}`);
    }
  }
}

// ---------------------------------------------------------------------------
// createStdioTransport
// ---------------------------------------------------------------------------

/**
 * Create a stdio ACP transport.
 *
 * Routes ndjson over process.stdin / process.stdout.
 * All diagnostic output must use stderr so stdout remains clean for ACP.
 */
export function createStdioTransport(): AcpStream {
  return _createStdioTransport();
}

// ---------------------------------------------------------------------------
// createTcpTransportFromSocket
// ---------------------------------------------------------------------------

/** Options for TCP socket hardening */
export type TcpSocketOptions = {
  /**
   * Connection timeout in milliseconds.
   * When set, the socket will emit a timeout event after this duration of inactivity.
   * The transport will close the readable side and emit an error on timeout.
   * Default: no timeout.
   */
  timeoutMs?: number;
  /**
   * Whether to keep the TCP connection alive with keepalive probes.
   * Default: true.
   */
  keepAlive?: boolean;
  /**
   * Initial keepalive delay in milliseconds.
   * Default: 0 (OS default).
   */
  keepAliveInitialDelay?: number;
};

/**
 * Create an ACP TCP transport from an already-connected `net.Socket`.
 *
 * Hardened implementation:
 * - Proper connection error handling with readable side error signalling
 * - Connection timeout support
 * - Backpressure via TCP socket's built-in flow control
 * - Partial message handling via patchIncomingStream line buffering
 * - TCP keepalive enabled by default to detect dead connections
 *
 * Used by the DaemonManager: when a client connects, the socket emitted on
 * the `daemon:connection` event is passed directly here, wrapping it into an
 * ACP-compatible ndJson bidirectional stream.
 *
 * @param socket - A connected TCP socket (from `net.createServer` callback)
 * @param options - Optional hardening configuration
 * @returns An ACP ndJson stream suitable for use with AgentSideConnection
 *
 * @example
 * ```typescript
 * daemonManager.on('daemon:connection', ({ socket }) => {
 *   const stream = createTcpTransportFromSocket(socket, { timeoutMs: 30000 });
 *   const conn = new acp.AgentSideConnection(agentFactory, stream);
 * });
 * ```
 */
export function createTcpTransportFromSocket(
  socket: Socket,
  options: TcpSocketOptions = {},
): AcpStream {
  const { timeoutMs, keepAlive = true, keepAliveInitialDelay = 0 } = options;

  // Enable TCP keepalive to detect dead connections
  if (keepAlive) {
    socket.setKeepAlive(true, keepAliveInitialDelay);
  }

  // Apply timeout if requested
  if (timeoutMs !== undefined && timeoutMs > 0) {
    socket.setTimeout(timeoutMs);
  }

  // Build a hardened readable stream that propagates socket errors and timeouts
  const incomingStream = _buildHardenedReadable(socket);

  return acp.ndJsonStream(
    Writable.toWeb(socket) as unknown as WritableStream<Uint8Array>,
    patchIncomingStream(incomingStream),
  );
}

// ---------------------------------------------------------------------------
// createWebSocketTransport — client mode
// ---------------------------------------------------------------------------

/** Options for a WebSocket client transport */
export type WebSocketClientOptions = {
  /**
   * Connection timeout in milliseconds.
   * If the WebSocket does not open within this duration, the connection is
   * aborted and the returned promise rejects.
   * Default: 30000 (30 seconds).
   */
  connectTimeoutMs?: number;
  /**
   * Additional headers to send on the WebSocket handshake (e.g. auth tokens).
   */
  headers?: Record<string, string>;
};

/**
 * Create an ACP WebSocket transport in client mode.
 *
 * Connects to a WebSocket server at the given URL and wraps the connection
 * into an ACP-compatible ndJson bidirectional stream. Each WebSocket message
 * is treated as one ndjson line (JSON-RPC 2.0 message). Messages are sent as
 * UTF-8 text frames.
 *
 * The returned AcpStream's readable side will close when the WebSocket closes
 * or errors. The writable side can be used to send messages.
 *
 * @param url - WebSocket server URL (e.g. "ws://localhost:3000/acp")
 * @param options - Optional client configuration
 * @returns Promise resolving to an ACP ndJson stream
 *
 * @throws Error if the connection cannot be established within `connectTimeoutMs`
 *
 * @example
 * ```typescript
 * const stream = await createWebSocketTransport('ws://localhost:3000/acp');
 * const conn = new acp.AgentSideConnection(agentFactory, stream);
 * ```
 */
export function createWebSocketTransport(
  url: string,
  options: WebSocketClientOptions = {},
): Promise<AcpStream> {
  const { connectTimeoutMs = 30_000 } = options;

  return new Promise<AcpStream>((resolve, reject) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const settle = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
        timeoutHandle = undefined;
      }
      if (err) reject(err);
    };

    // Connection timeout guard
    if (connectTimeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        settle(new Error(`WebSocket connection to ${url} timed out after ${connectTimeoutMs}ms`));
        try {
          ws.close();
        } catch {
          // ignore
        }
      }, connectTimeoutMs);
    }

    // Bun native WebSocket — available as global in Bun runtime.
    // Bun extends the standard WebSocket constructor to accept an options object
    // as the second argument, supporting `headers` for the HTTP upgrade request.
    // The standard browser WebSocket API only accepts protocols as the second arg.
    // NOTE: If running in a non-Bun environment, headers will be silently ignored
    // by the runtime's WebSocket implementation.
    const ws =
      options.headers && Object.keys(options.headers).length > 0
        ? new WebSocket(url, { headers: options.headers } as unknown as string[])
        : new WebSocket(url);

    // Readable side: WebSocket messages → stream chunks
    let readableController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        readableController = controller;
      },
      cancel() {
        // Consumer cancelled — close the WebSocket
        try {
          ws.close(1000, 'Client cancelled');
        } catch {
          // ignore
        }
      },
    });

    // Writable side: stream chunks → WebSocket messages
    let writableController: WritableStreamDefaultController | null = null;
    const decoder = new TextDecoder();
    let writeBuffer = '';

    const writable = new WritableStream<Uint8Array>({
      start(controller) {
        writableController = controller;
      },
      write(chunk) {
        // Buffer and send complete ndjson lines as individual WebSocket messages
        writeBuffer += decoder.decode(chunk, { stream: true });
        const lines = writeBuffer.split('\n');
        writeBuffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length > 0) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(trimmed);
            } else {
              writableController?.error(new Error('WebSocket is not open'));
              return;
            }
          }
        }
      },
      close() {
        // Flush any remaining content
        const remaining = writeBuffer.trim();
        if (remaining.length > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(remaining);
        }
        ws.close(1000, 'Stream closed');
      },
      abort(reason) {
        try {
          ws.close(1011, String(reason));
        } catch {
          // ignore
        }
      },
    });

    ws.onopen = () => {
      if (settled) return;
      settled = true;
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
        timeoutHandle = undefined;
      }
      resolve(acp.ndJsonStream(writable, patchIncomingStream(readable)));
    };

    ws.onmessage = (event) => {
      if (readableController === null) return;
      const data = typeof event.data === 'string' ? event.data : String(event.data);
      // Each WS message is one JSON-RPC message — enqueue as UTF-8 bytes with newline
      readableController.enqueue(encoder.encode(data + '\n'));
    };

    ws.onerror = (_event) => {
      const err = new Error(`WebSocket error connecting to ${url}`);
      readableController?.error(err);
      writableController?.error(err);
      settle(err);
    };

    ws.onclose = (event) => {
      // Settle the promise if not yet open (connection refused scenario)
      if (!settled) {
        settle(
          new Error(
            `WebSocket closed before open: code=${event.code} reason=${event.reason || 'none'}`,
          ),
        );
      }
      // Close the readable side cleanly
      try {
        readableController?.close();
      } catch {
        // Already closed
      }
    };
  });
}

// ---------------------------------------------------------------------------
// createWebSocketServerStream — server mode
// ---------------------------------------------------------------------------

/**
 * A minimal interface representing a server-side WebSocket connection.
 * Compatible with Bun's WebSocket server data object and the `ws` package's
 * WebSocket class (server-side).
 */
export type WebSocketServerSocket = {
  /** Send a text message to the client */
  send(data: string): void;
  /** Close the connection */
  close(code?: number, reason?: string): void;
  /** Register an event listener */
  addEventListener(event: 'message', handler: (event: { data: string | ArrayBuffer }) => void): void;
  addEventListener(event: 'close', handler: (event: { code: number; reason: string }) => void): void;
  addEventListener(event: 'error', handler: (event: unknown) => void): void;
};

/**
 * Create an ACP transport from a server-side WebSocket connection.
 *
 * Use this when implementing an ACP WebSocket server. In Bun, create a server
 * with `Bun.serve()` using a `websocket` handler, and pass the WebSocket
 * instance to this function when a client connects.
 *
 * Each WebSocket message is treated as one ndjson line (JSON-RPC 2.0 message).
 * Messages are sent as UTF-8 text frames.
 *
 * @param ws - An open server-side WebSocket connection
 * @returns An ACP ndJson stream suitable for use with AgentSideConnection
 *
 * @example
 * ```typescript
 * // Bun.serve() server mode
 * Bun.serve({
 *   websocket: {
 *     open(ws) {
 *       const stream = createWebSocketServerStream(ws);
 *       const conn = new acp.AgentSideConnection(agentFactory, stream);
 *     },
 *     message(ws, msg) { ... },
 *   },
 * });
 * ```
 */
export function createWebSocketServerStream(ws: WebSocketServerSocket): AcpStream {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Guard against double-error from error + close event firing in sequence
  let closed = false;

  // Readable side: incoming WS messages → stream chunks
  let readableController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      readableController = controller;
    },
    cancel() {
      try {
        ws.close(1000, 'Client cancelled');
      } catch {
        // ignore
      }
    },
  });

  // Writable side: stream chunks → WS messages
  let writableController: WritableStreamDefaultController | null = null;
  let writeBuffer = '';
  const writable = new WritableStream<Uint8Array>({
    start(controller) {
      writableController = controller;
    },
    write(chunk) {
      writeBuffer += decoder.decode(chunk, { stream: true });
      const lines = writeBuffer.split('\n');
      writeBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          try {
            ws.send(trimmed);
          } catch (err) {
            writableController?.error(err);
            return;
          }
        }
      }
    },
    close() {
      const remaining = writeBuffer.trim();
      if (remaining.length > 0) {
        try {
          ws.send(remaining);
        } catch {
          // ignore
        }
      }
      ws.close(1000, 'Stream closed');
    },
    abort(reason) {
      try {
        ws.close(1011, String(reason));
      } catch {
        // ignore
      }
    },
  });

  // Wire WebSocket events into the readable stream
  ws.addEventListener('message', (event) => {
    if (readableController === null) return;
    const data = typeof event.data === 'string' ? event.data : String(event.data);
    readableController.enqueue(encoder.encode(data + '\n'));
  });

  ws.addEventListener('error', (_event) => {
    if (closed) return;
    closed = true;
    const err = new Error('WebSocket server connection error');
    try {
      readableController?.error(err);
    } catch {
      // Already errored
    }
    try {
      writableController?.error(err);
    } catch {
      // Already errored
    }
  });

  ws.addEventListener('close', (event) => {
    if (!closed) {
      try {
        readableController?.close();
      } catch {
        // Already closed
      }
    }
    // Signal writable error if closed unexpectedly (not a normal closure)
    // Only if we haven't already handled it in the error handler
    if (!closed && event.code !== 1000 && event.code !== 1001) {
      closed = true;
      try {
        writableController?.error(
          new Error(`WebSocket closed unexpectedly: code=${event.code} reason=${event.reason || 'none'}`),
        );
      } catch {
        // Already errored
      }
    }
    closed = true;
  });

  return acp.ndJsonStream(writable, patchIncomingStream(readable));
}

// ---------------------------------------------------------------------------
// Internal: stdio implementation
// ---------------------------------------------------------------------------

function _createStdioTransport(): AcpStream {
  return acp.ndJsonStream(
    Writable.toWeb(process.stdout) as unknown as WritableStream<Uint8Array>,
    patchIncomingStream(Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>),
  );
}

// ---------------------------------------------------------------------------
// Internal: hardened readable stream from TCP socket
// ---------------------------------------------------------------------------

/**
 * Builds a ReadableStream from a TCP socket that properly propagates errors
 * and timeout events to the stream consumer.
 *
 * Handles:
 * - socket 'error' events → ReadableStream error
 * - socket 'timeout' events → ReadableStream error (inactivity timeout)
 * - socket 'close' events → ReadableStream close
 * - Backpressure via socket pause/resume (Node.js streams handle this natively
 *   when converting with Readable.toWeb, which respects pull-based consumption)
 */
function _buildHardenedReadable(socket: Socket): ReadableStream<Uint8Array> {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;

      // Pipe socket data into the stream
      socket.on('data', (chunk: Buffer) => {
        if (closed) return;
        try {
          controller!.enqueue(new Uint8Array(chunk));
        } catch {
          // Controller already errored/closed
        }
      });

      // Socket closed cleanly
      socket.on('end', () => {
        if (closed) return;
        closed = true;
        try {
          controller!.close();
        } catch {
          // Already closed
        }
      });

      // Connection error — propagate to stream consumer
      socket.on('error', (err: Error) => {
        if (closed) return;
        closed = true;
        try {
          controller!.error(err);
        } catch {
          // Already errored
        }
      });

      // Inactivity timeout — treat as an error
      socket.on('timeout', () => {
        if (closed) return;
        closed = true;
        socket.destroy();
        try {
          controller!.error(
            new Error(`TCP socket timed out after inactivity (timeout set on socket)`),
          );
        } catch {
          // Already errored
        }
      });

      // Socket destroyed (e.g. remote end reset)
      socket.on('close', (hadError: boolean) => {
        if (closed) return;
        closed = true;
        if (hadError) {
          try {
            controller!.error(new Error('TCP socket closed with error'));
          } catch {
            // Already errored
          }
        } else {
          try {
            controller!.close();
          } catch {
            // Already closed
          }
        }
      });
    },
    cancel() {
      // Consumer cancelled — destroy the socket
      if (!socket.destroyed) {
        socket.destroy();
      }
    },
  });

  return stream;
}

// ---------------------------------------------------------------------------
// patchIncomingStream
// ---------------------------------------------------------------------------

/**
 * Wraps an incoming ndjson byte stream and patches `initialize` requests that
 * are missing `protocolVersion`. Zed (and other editors) may omit this field,
 * causing the ACP SDK's Zod validation to reject the request before our own
 * handler can apply a default.
 *
 * The transform:
 * 1. Buffers incoming bytes, splitting on newline (`\n`) boundaries.
 * 2. For each complete line, attempts JSON.parse.
 * 3. If it is a JSON-RPC request with `method: "initialize"` and
 *    `params.protocolVersion` is undefined/missing, injects `protocolVersion: 1`.
 * 4. Re-serialises the (possibly modified) object and emits as UTF-8 bytes
 *    followed by a `\n`.
 * 5. Non-JSON lines and all other messages are passed through unchanged.
 *
 * @param input - The raw ReadableStream of ndjson bytes from stdin or socket
 * @returns A patched ReadableStream that can be passed to `acp.ndJsonStream()`
 */
export function patchIncomingStream(
  input: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';

  return input.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        // Last element is an incomplete line (no trailing \n yet) — keep buffered
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          controller.enqueue(encoder.encode(patchLine(line) + '\n'));
        }
      },
      flush(controller) {
        // Emit any remaining buffered content (stream closed mid-line)
        if (buffer.length > 0) {
          controller.enqueue(encoder.encode(patchLine(buffer) + '\n'));
          buffer = '';
        }
      },
    }),
  );
}

/**
 * Patch a single ndjson line: inject `protocolVersion` on `initialize` requests
 * that are missing it. Returns the line unchanged if parsing fails or it is not
 * an `initialize` request.
 */
function patchLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length === 0) return line;
  let msg: unknown;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    // Not valid JSON — pass through as-is
    return line;
  }
  if (
    msg !== null &&
    typeof msg === 'object' &&
    'method' in msg &&
    (msg as Record<string, unknown>)['method'] === 'initialize' &&
    'params' in msg
  ) {
    const params = (msg as Record<string, unknown>)['params'];
    if (params !== null && typeof params === 'object') {
      const p = params as Record<string, unknown>;
      if (p['protocolVersion'] === undefined) {
        p['protocolVersion'] = DEFAULT_PROTOCOL_VERSION;
        return JSON.stringify(msg);
      }
    }
  }
  return line;
}

// ---------------------------------------------------------------------------
// TCP transport stub (factory redirect)
// ---------------------------------------------------------------------------

/**
 * TCP transport — factory redirect.
 *
 * @throws Error — use createTcpTransportFromSocket directly
 * @internal
 */
function _createTcpTransport(_options: TcpTransportOptions): AcpStream {
  // TCP daemon mode uses a different pattern: the DaemonManager creates the
  // server and emits connected sockets via `daemon:connection` events.
  // Use `createTcpTransportFromSocket(socket)` to wrap each connected socket.
  throw new Error(
    "createTransport({ type: 'tcp' }) is not supported. " +
    'For daemon mode, use createTcpTransportFromSocket(socket) with the DaemonManager pattern: ' +
    'listen for daemon:connection events and call createTcpTransportFromSocket on each socket.',
  );
}

// ---------------------------------------------------------------------------
// WebSocket transport stub (factory redirect)
// ---------------------------------------------------------------------------

/**
 * WebSocket transport — factory redirect.
 *
 * @throws Error — use createWebSocketTransport or createWebSocketServerStream directly
 * @internal
 */
function _createWebSocketTransportStub(_options: WebSocketTransportOptions): AcpStream {
  // createTransport({ type: 'websocket' }) is not supported via the factory.
  // WebSocket transport is implemented as two dedicated functions:
  //   - createWebSocketTransport(url, options) — client mode (connects to a WS server)
  //   - createWebSocketServerStream(ws, options) — server mode (wraps a connected server socket)
  throw new Error(
    "createTransport({ type: 'websocket' }) is not supported via factory. " +
    'For client mode, use createWebSocketTransport(url) to connect to a WebSocket server. ' +
    'For server mode, use createWebSocketServerStream(ws) to wrap a connected server-side WebSocket.',
  );
}

// ---------------------------------------------------------------------------
// Re-export TransportType for consumer convenience
// ---------------------------------------------------------------------------

export type { TransportType };
