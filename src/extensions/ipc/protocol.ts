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
  /**
   * Internal discriminant — message category (e.g. 'request', 'response', 'notification').
   * @internal Not serialized on the wire; stripped by serializeMessage.
   */
  type: string;
  /** Unique message identifier (monotonic counter or cuid) */
  id: string;
  /**
   * Optional metadata bag for out-of-band context.
   *
   * Reserved keys per KB-08 (W3C Trace Context):
   * - `traceparent` — W3C traceparent header value (e.g. '00-4bf92f3577...-00f067aa...-01')
   * - `tracestate`  — W3C tracestate header value (vendor-specific k=v pairs)
   */
  _meta?: Record<string, unknown> & { timestamp?: number; traceparent?: string; tracestate?: string };
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
export interface IpcResponse extends Omit<IpcMessage, 'id'> {
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
  /** The method name identifying the notification (e.g. 'runtime:status-changed') */
  method: string;
  /** Arbitrary notification payload */
  params: unknown;
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialize an IPC message to a newline-delimited JSON string suitable for
 * sending over a Unix socket.
 *
 * The `type` field is an internal-only discriminant and is stripped from the
 * wire representation per JSON-RPC 2.0 (which uses structural shape, not a
 * type tag, to distinguish message kinds).
 */
export function serializeMessage(message: IpcMessage | IpcResponse | IpcNotification): string {
  const { type: _type, ...wire } = message as IpcMessage & { type: string };
  return JSON.stringify(wire) + '\n';
}

/**
 * Deserialize a single NDJSON line into an IpcMessage.
 *
 * Per JSON-RPC 2.0, message kind is inferred from structural shape:
 * - Notification: has `method`, no `id`
 * - Request:      has `method` and `id`
 * - Response:     has `result` or `error` and `id`
 *
 * The `type` field is injected internally after structural discrimination
 * to allow consumers to use it as a discriminant without wire overhead.
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
    rec.jsonrpc !== '2.0'
  ) {
    throw new TypeError(
      'IPC message missing required fields: jsonrpc ("2.0")',
    );
  }

  // Infer message kind from structural shape per JSON-RPC 2.0
  const hasMethod = typeof rec.method === 'string';
  const hasId = typeof rec.id === 'string' || typeof rec.id === 'number';
  const hasResult = 'result' in rec;
  const hasError = typeof rec.error === 'object' && rec.error !== null;

  let type: string;
  if (hasMethod && !hasId) {
    // Notification: method present, no id
    type = 'notification';
  } else if (hasMethod && hasId) {
    // Request: method + id
    type = 'request';
  } else if ((hasResult || hasError) && (hasId || rec.id === null)) {
    // Response: result or error + id
    type = 'response';
  } else {
    throw new TypeError(
      'IPC message could not be classified: must be a request (method+id), ' +
      'response (result|error + id), or notification (method, no id)',
    );
  }

  // Inject type discriminant for internal consumer use (not a wire field)
  rec.type = type;

  return rec as unknown as IpcMessage;
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
  method: string,
  params: unknown = null,
): IpcNotification {
  return {
    jsonrpc: '2.0',
    type: 'notification',
    method,
    params,
  };
}
