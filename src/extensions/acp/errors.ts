/**
 * @module acp/errors
 * @layer L2 — ACP protocol error code mapping
 *
 * JSON-RPC 2.0 error codes used by the GoodVibes ACP agent.
 */

// ---------------------------------------------------------------------------
// ACP error codes
// ---------------------------------------------------------------------------

/**
 * JSON-RPC 2.0 error codes for the GoodVibes ACP agent.
 * Standard codes (-32700 to -32603) are defined by the JSON-RPC spec.
 * Application codes (-32000 and below) are GoodVibes-specific.
 */
export const ACP_ERROR_CODES = {
  /** Parse error — invalid JSON was received */
  PARSE_ERROR: -32700,
  /** Invalid request — the JSON sent is not a valid Request object */
  INVALID_REQUEST: -32600,
  /** Method not found — the method does not exist or is not available */
  METHOD_NOT_FOUND: -32601,
  /** Invalid params — invalid method parameters */
  INVALID_PARAMS: -32602,
  /** Internal error — internal JSON-RPC error */
  INTERNAL_ERROR: -32603,
  /** Session not found — the requested session does not exist */
  SESSION_NOT_FOUND: -32000,
  /** Session load failed — failed to load an existing session */
  SESSION_LOAD_FAILED: -32001,
  /** MCP connect failed — failed to connect to an MCP server */
  MCP_CONNECT_FAILED: -32002,
  /** Permission denied — the operation is not permitted */
  PERMISSION_DENIED: -32003,
  /** Agent spawn failed — failed to spawn a sub-agent */
  AGENT_SPAWN_FAILED: -32004,
  /** Request cancelled — the request was cancelled before completion */
  REQUEST_CANCELLED: -32800,
} as const;

export type AcpErrorCode = (typeof ACP_ERROR_CODES)[keyof typeof ACP_ERROR_CODES];

// ---------------------------------------------------------------------------
// Error shape
// ---------------------------------------------------------------------------

export type AcpErrorShape = {
  code: number;
  message: string;
  data?: unknown;
};

// ---------------------------------------------------------------------------
// toAcpError
// ---------------------------------------------------------------------------

/**
 * Map any thrown value to an ACP error shape.
 *
 * Never throws — always returns a valid error shape.
 */
export function toAcpError(err: unknown): AcpErrorShape {
  if (err instanceof Error) {
    const msg = err.message;

    // Map well-known error messages to specific codes
    if (msg.startsWith('Session not found')) {
      return { code: ACP_ERROR_CODES.SESSION_NOT_FOUND, message: msg };
    }
    if (msg.startsWith('Session load failed')) {
      return { code: ACP_ERROR_CODES.SESSION_LOAD_FAILED, message: msg };
    }
    if (msg.startsWith('MCP connect failed')) {
      return { code: ACP_ERROR_CODES.MCP_CONNECT_FAILED, message: msg };
    }
    if (msg.startsWith('Permission denied')) {
      return { code: ACP_ERROR_CODES.PERMISSION_DENIED, message: msg };
    }
    if (msg.startsWith('Agent spawn failed')) {
      return { code: ACP_ERROR_CODES.AGENT_SPAWN_FAILED, message: msg };
    }
    if (msg.startsWith('Request cancelled') || msg.startsWith('Cancelled')) {
      return { code: ACP_ERROR_CODES.REQUEST_CANCELLED, message: msg };
    }

    return {
      code: ACP_ERROR_CODES.INTERNAL_ERROR,
      message: msg,
      data: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };
  }

  if (typeof err === 'string') {
    return { code: ACP_ERROR_CODES.INTERNAL_ERROR, message: err };
  }

  return {
    code: ACP_ERROR_CODES.INTERNAL_ERROR,
    message: 'An unknown error occurred',
    data: err,
  };
}
