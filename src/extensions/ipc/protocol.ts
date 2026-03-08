/**
 * @module ipc/protocol
 * @layer L2 — extensions
 *
 * IPC wire protocol for inter-process communication.
 *
 * Message format: newline-delimited JSON (NDJSON) over Unix domain sockets.
 * Every message is a JSON object followed by a '\n' delimiter.
 *
 * Follows JSON-RPC 2.0 conventions for request/response correlation:
 * - Responses carry the same `id` as the originating request.
 * - Notifications omit `id` entirely (fire-and-forget).
 * - Error responses use a structured error object with `code` and `message`.
 */

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

/** Structured error object per JSON-RPC 2.0 */
export interface IpcError {
  /** Numeric error code (e.g. -32700 parse error, -32601 method not found) */
  code: number;
  /** Human-readable error description */
  message: string;
  /** Optional additional error context */
  data?: unknown;
}

/** A single IPC message flowing over the wire */
export interface IpcMessage {
  /** JSON-RPC 2.0 version string — always '2.0' */
  jsonrpc: '2.0';
  /** Discriminant — message category (e.g. 'request', 'response', 'notification') */
  type: string;
  /** Unique message identifier (monotonic counter or cuid) */
  id: string;
  /** Optional metadata (e.g. timestamp) */
  _meta?: { timestamp?: number };
}

/** An IPC request — expects a correlated IpcResponse */
export interface IpcRequest extends IpcMessage {
  type: 'request';
  /** The named operation to invoke (e.g. 'ping', 'status') */
  method: string;
  /** Arbitrary request payload */
  params: unknown;
}

/** An IPC response — id matches the originating IpcRequest id */
export interface IpcResponse {
  /** JSON-RPC 2.0 version string — always '2.0' */
  jsonrpc: '2.0';
  type: 'response';
  /** ID copied from the originating IpcRequest; null for parse errors */
  id: string | null;
  /** Result payload on success (mutually exclusive with error) */
  result?: unknown;
  /** Structured error on failure (mutually exclusive with result) */
  error?: IpcError;
}

/** A one-way IPC notification (no response expected, no id) */
export interface IpcNotification extends Omit<IpcMessage, 'id'> {
  type: 'notification';
  /** The event name (e.g. 'runtime:status-changed') */
  event: string;
  /** Arbitrary notification payload */
  params: unknown;
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialize an IPC message to a newline-delimited JSON string suitable for
 * sending over a Unix socket.
 */
export function serializeMessage(message: IpcMessage | IpcResponse | IpcNotification): string {
  return JSON.stringify(message) + '\n';
}

/**
 * Deserialize a single NDJSON line into an IpcMessage.
 *
 * @throws {SyntaxError} if the line is not valid JSON.
 * @throws {TypeError} if the parsed value is not an object with required fields.
 */
export function deserializeMessage(line: string): IpcMessage {
  const parsed: unknown = JSON.parse(line.trim());

  const rec = parsed as Record<string, unknown>;

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    rec.jsonrpc !== '2.0' ||
    typeof rec.type !== 'string'
  ) {
    throw new TypeError(
      'IPC message missing required fields: jsonrpc ("2.0"), type (string)',
    );
  }

  // Notifications do not have an id
  if (rec.type !== 'notification' && typeof rec.id !== 'string') {
    throw new TypeError('IPC request/response message missing required field: id (string)');
  }

  // Additional structural validation per message type
  if (rec.type === 'request' && typeof rec.method !== 'string') {
    throw new TypeError('IPC request message missing required field: method (string)');
  }
  if (rec.type === 'notification' && typeof rec.event !== 'string') {
    throw new TypeError('IPC notification message missing required field: event (string)');
  }

  return parsed as IpcMessage;
}

/**
 * Build a well-formed IpcRequest.
 */
export function buildRequest(
  id: string,
  method: string,
  params: unknown = null,
): IpcRequest {
  return {
    jsonrpc: '2.0',
    type: 'request',
    id,
    method,
    params,
  };
}

/**
 * Build a well-formed IpcResponse.
 *
 * @param id      The request id to correlate; null for parse-error responses.
 * @param result  The success payload (pass null on error).
 * @param error   Structured error object; if provided, result is omitted.
 */
export function buildResponse(
  id: string | null,
  result: unknown = null,
  error?: IpcError,
): IpcResponse {
  const response: IpcResponse = {
    jsonrpc: '2.0',
    type: 'response',
    id,
  };
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  return response;
}

/**
 * Build a well-formed IpcNotification.
 */
export function buildNotification(
  event: string,
  params: unknown = null,
): IpcNotification {
  return {
    jsonrpc: '2.0',
    type: 'notification',
    event,
    params,
  };
}
