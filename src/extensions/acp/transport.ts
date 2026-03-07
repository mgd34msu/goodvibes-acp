/**
 * transport.ts — ACP transport abstraction
 *
 * L2 Extension — imports from L0 types and @agentclientprotocol/sdk.
 * Provides a factory function that creates ACP-compatible bidirectional
 * streams for different transport types.
 *
 * stdio transport — current implementation, used in main.ts
 * tcp       transport — stub for daemon mode
 * websocket transport — stub for browser/remote clients
 */

import { Readable, Writable } from 'node:stream';
import type { Socket } from 'node:net';
import * as acp from '@agentclientprotocol/sdk';
import type { TransportType } from '../../types/transport.js';

// ---------------------------------------------------------------------------
// Transport options
// ---------------------------------------------------------------------------

/** Options for a stdio transport (no additional fields required) */
export type StdioTransportOptions = {
  type: 'stdio';
};

/** Options for a TCP transport (stub — not yet implemented) */
export type TcpTransportOptions = {
  type: 'tcp';
  host?: string;
  port: number;
};

/** Options for a WebSocket transport (stub — not yet implemented) */
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
// createTransport
// ---------------------------------------------------------------------------

/**
 * Create an ACP-compatible bidirectional stream for the given transport type.
 *
 * @param options - Transport configuration
 * @returns An ACP ndJson stream suitable for use with AgentSideConnection
 *
 * @throws Error when a non-stdio transport type is requested (stubs not implemented)
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
      return _createWebSocketTransport(options);

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

/**
 * Create an ACP TCP transport from an already-connected `net.Socket`.
 *
 * Used by the DaemonManager: when a client connects, the socket emitted on
 * the `daemon:connection` event is passed directly here, wrapping it into an
 * ACP-compatible ndJson bidirectional stream.
 *
 * The double-cast pattern (`as unknown as WritableStream<Uint8Array>`) is
 * required for Node→Web stream type interop.
 *
 * @param socket - A connected TCP socket (from `net.createServer` callback)
 * @returns An ACP ndJson stream suitable for use with AgentSideConnection
 *
 * @example
 * ```typescript
 * daemonManager.on('daemon:connection', ({ socket }) => {
 *   const stream = createTcpTransportFromSocket(socket);
 *   const conn = new acp.AgentSideConnection(agentFactory, stream);
 * });
 * ```
 */
export function createTcpTransportFromSocket(socket: Socket): AcpStream {
  return acp.ndJsonStream(
    Writable.toWeb(socket) as unknown as WritableStream<Uint8Array>,
    Readable.toWeb(socket) as unknown as ReadableStream<Uint8Array>,
  );
}

function _createStdioTransport(): AcpStream {
  return acp.ndJsonStream(
    Writable.toWeb(process.stdout) as unknown as WritableStream<Uint8Array>,
    Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>,
  );
}

// ---------------------------------------------------------------------------
// TCP transport stub
// ---------------------------------------------------------------------------

/**
 * TCP transport — stub for daemon mode.
 *
 * @throws Error — not yet implemented
 * @internal
 */
function _createTcpTransport(_options: TcpTransportOptions): AcpStream {
  // TCP daemon mode uses a different pattern: the DaemonManager creates the
  // server and emits connected sockets via `daemon:connection` events.
  // Use `createTcpTransportFromSocket(socket)` to wrap each connected socket.
  throw new Error(
    'createTransport({ type: \'tcp\' }) is not supported. ' +
    'For daemon mode, use createTcpTransportFromSocket(socket) with the DaemonManager pattern: ' +
    'listen for daemon:connection events and call createTcpTransportFromSocket on each socket.',
  );
}

// ---------------------------------------------------------------------------
// WebSocket transport stub
// ---------------------------------------------------------------------------

/**
 * WebSocket transport — stub for browser/remote clients.
 *
 * @throws Error — not yet implemented
 * @internal
 */
function _createWebSocketTransport(_options: WebSocketTransportOptions): AcpStream {
  // Planned for future support of browser-based and remote clients.
  // Will require a WebSocket server (e.g. `ws` or Bun native WS) that wraps
  // each connection's duplex streams into the ndJsonStream format.
  throw new Error(
    'WebSocket transport is not yet implemented. ' +
    'It is planned for future browser and remote client support. ' +
    'Use stdio transport for the current release.',
  );
}

// ---------------------------------------------------------------------------
// Re-export TransportType for consumer convenience
// ---------------------------------------------------------------------------

export type { TransportType };
