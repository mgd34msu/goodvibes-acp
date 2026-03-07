/**
 * @module ipc/protocol
 * @layer L2 — extensions
 *
 * IPC wire protocol for inter-process communication.
 *
 * Message format: newline-delimited JSON (NDJSON) over Unix domain sockets.
 * Every message is a JSON object followed by a '\n' delimiter.
 *
 * Request/response correlation is handled via a shared `id` field.
 * Responses reference the originating request `id` in the `correlationId` field.
 */

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

/** A single IPC message flowing over the wire */
export interface IpcMessage {
  /** Discriminant — message category (e.g. 'request', 'response', 'notification') */
  type: string;
  /** Unique message identifier (monotonic counter or cuid) */
  id: string;
  /** Arbitrary message payload */
  payload: unknown;
  /** Unix timestamp (ms) when this message was created */
  timestamp: number;
}

/** An IPC request — expects a correlated IpcResponse */
export interface IpcRequest extends IpcMessage {
  type: 'request';
  /** The named operation to invoke (e.g. 'ping', 'status') */
  method: string;
}

/** An IPC response — correlates to an IpcRequest */
export interface IpcResponse extends IpcMessage {
  type: 'response';
  /** ID of the IpcRequest this response answers */
  correlationId: string;
  /** true if the operation succeeded */
  ok: boolean;
  /** Error message if ok === false */
  error?: string;
}

/** A one-way IPC notification (no response expected) */
export interface IpcNotification extends IpcMessage {
  type: 'notification';
  /** The event name (e.g. 'runtime:status-changed') */
  event: string;
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialize an IPC message to a newline-delimited JSON string suitable for
 * sending over a Unix socket.
 */
export function serializeMessage(message: IpcMessage): string {
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

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).type !== 'string' ||
    typeof (parsed as Record<string, unknown>).id !== 'string' ||
    typeof (parsed as Record<string, unknown>).timestamp !== 'number'
  ) {
    throw new TypeError(
      'IPC message missing required fields: type (string), id (string), timestamp (number)',
    );
  }

  return parsed as IpcMessage;
}

/**
 * Build a well-formed IpcRequest.
 */
export function buildRequest(
  id: string,
  method: string,
  payload: unknown = null,
): IpcRequest {
  return {
    type: 'request',
    id,
    method,
    payload,
    timestamp: Date.now(),
  };
}

/**
 * Build a well-formed IpcResponse.
 */
export function buildResponse(
  id: string,
  correlationId: string,
  ok: boolean,
  payload: unknown = null,
  error?: string,
): IpcResponse {
  return {
    type: 'response',
    id,
    correlationId,
    ok,
    payload,
    error,
    timestamp: Date.now(),
  };
}

/**
 * Build a well-formed IpcNotification.
 */
export function buildNotification(
  id: string,
  event: string,
  payload: unknown = null,
): IpcNotification {
  return {
    type: 'notification',
    id,
    event,
    payload,
    timestamp: Date.now(),
  };
}
