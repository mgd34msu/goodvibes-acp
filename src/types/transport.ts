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
 * A JSON-RPC 2.0 message as transmitted on the ACP wire.
 * Use the specific subtypes (RequestMessage, ResponseMessage, NotificationMessage)
 * for type-narrowing via discriminated union.
 */
export type AnyMessage = RequestMessage | ResponseMessage | NotificationMessage;

/**
 * A bidirectional stream with typed readable and writable ends.
 *
 * NOTE: WritableStream and ReadableStream are Web Streams API globals.
 * They are available natively in Bun and in Node.js 18+. If targeting
 * an older Node.js version, import from the `stream/web` module or
 * install a polyfill.
 */
export type Stream = {
  writable: WritableStream<AnyMessage>;
  readable: ReadableStream<AnyMessage>;
};

// ---------------------------------------------------------------------------
// Transport type
// ---------------------------------------------------------------------------

/**
 * The type of transport protocol in use.
 * ACP-standard: stdio, http, websocket. GoodVibes extensions: tcp, unix-socket
 */
export type TransportType = 'stdio' | 'http' | 'websocket' | 'tcp' | 'unix-socket';

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
// Message (JSON-RPC 2.0 discriminated union)
// ---------------------------------------------------------------------------

/** JSON-RPC 2.0 base — common to all message types */
type JsonRpcBase = {
  /** JSON-RPC version (always "2.0") */
  jsonrpc: '2.0';
};

/**
 * A JSON-RPC 2.0 request — has both `id` and `method`.
 * Discriminated by presence of `method` with a required `id`.
 */
export type RequestMessage = JsonRpcBase & {
  /** Request/response correlation ID */
  id: string | number;
  /** Method to invoke */
  method: string;
  /** Method parameters */
  params?: unknown;
};

/**
 * A JSON-RPC 2.0 notification — has `method` but no `id`.
 * Fire-and-forget; no response is expected.
 */
export type NotificationMessage = JsonRpcBase & {
  id?: never;
  /** Method to invoke */
  method: string;
  /** Method parameters */
  params?: unknown;
};

/**
 * A JSON-RPC 2.0 response — has `id` but no `method`.
 * Carries either `result` (success) or `error` (failure).
 */
export type ResponseMessage = JsonRpcBase & {
  /** Correlates to the originating request */
  id: string | number | null;
  method?: never;
} & (
    | { result: unknown; error?: never }
    | {
        result?: never;
        error: {
          code: number;
          message: string;
          data?: unknown;
        };
      }
  );

/**
 * Discriminated union of all JSON-RPC 2.0 message types used on the ACP wire.
 * Narrow to a specific type via the `method` and `id` fields.
 */
export type Message = RequestMessage | ResponseMessage | NotificationMessage;

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
