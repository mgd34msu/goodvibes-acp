/**
 * @module transport
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Generic transport types for the GoodVibes ACP runtime.
 * Abstract over protocol details — no stdio/TCP-specific logic here.
 */

// ---------------------------------------------------------------------------
// Stream
// ---------------------------------------------------------------------------

/**
 * A bidirectional stream with typed readable and writable ends.
 *
 * NOTE: WritableStream and ReadableStream are Web Streams API globals.
 * They are available natively in Bun and in Node.js 18+. If targeting
 * an older Node.js version, import from the `stream/web` module or
 * install a polyfill.
 */
export type Stream = {
  writable: WritableStream<unknown>;
  readable: ReadableStream<unknown>;
};

// ---------------------------------------------------------------------------
// Transport type
// ---------------------------------------------------------------------------

/** The type of transport protocol in use */
export type TransportType = 'stdio' | 'tcp' | 'websocket' | 'unix-socket';

// ---------------------------------------------------------------------------
// Transport configuration
// ---------------------------------------------------------------------------

/** Configuration for a TCP or WebSocket transport */
export type NetworkTransportOptions = {
  /** Hostname or IP (default: "localhost") */
  host?: string;
  /** Port number */
  port: number;
};

/** Configuration for a Unix socket transport */
export type UnixSocketTransportOptions = {
  /** Path to the Unix domain socket file */
  socketPath: string;
};

/** Configuration for stdio transport (no additional options needed) */
export type StdioTransportOptions = Record<string, never>;

/** Union of all transport option shapes */
export type TransportOptions =
  | NetworkTransportOptions
  | UnixSocketTransportOptions
  | StdioTransportOptions;

/** Full transport configuration */
export type TransportConfig = {
  /** Protocol type */
  type: TransportType;
  /** Protocol-specific options */
  options: TransportOptions;
};

// ---------------------------------------------------------------------------
// Message (JSON-RPC style)
// ---------------------------------------------------------------------------

/** A JSON-RPC 2.0 style message used on the wire */
export type Message = {
  /** JSON-RPC version (always "2.0") */
  jsonrpc: '2.0';
  /** Request/notification ID (absent for notifications) */
  id?: string | number;
  /** Method name (absent for responses) */
  method?: string;
  /** Method parameters (for requests/notifications) */
  params?: unknown;
  /** Result value (for successful responses) */
  result?: unknown;
  /** Error object (for error responses) */
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

/** State of a transport connection */
export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'error';

/** Metadata about a transport connection */
export type ConnectionInfo = {
  /** Unique connection identifier */
  id: string;
  /** Transport type */
  type: TransportType;
  /** Current connection state */
  state: ConnectionState;
  /** Unix timestamp (ms) when connection was established */
  connectedAt?: number;
  /** Remote address (for TCP/WS) */
  remoteAddress?: string;
};
