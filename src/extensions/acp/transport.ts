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
  // TODO: Implement TCP transport for daemon mode.
  // This will require a TCP server (e.g. `net.createServer`) that wraps
  // each connection's socket streams into the ndJsonStream format.
  throw new Error(
    'TCP transport is not yet implemented. Use stdio transport for the current release.',
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
  // TODO: Implement WebSocket transport for browser and remote clients.
  // This will require a WebSocket server (e.g. `ws` or Bun's native WS)
  // that wraps each connection's streams into the ndJsonStream format.
  throw new Error(
    'WebSocket transport is not yet implemented. Use stdio transport for the current release.',
  );
}

// ---------------------------------------------------------------------------
// Re-export TransportType for consumer convenience
// ---------------------------------------------------------------------------

export type { TransportType };
