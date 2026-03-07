/**
 * @module errors
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Error types, error codes, and error categories for the GoodVibes ACP runtime.
 */

// ---------------------------------------------------------------------------
// Error code enum
// ---------------------------------------------------------------------------

/**
 * Canonical error codes for runtime errors.
 * Used in GoodVibesError.code to identify error types machine-readably.
 */
export enum ErrorCode {
  /** Unclassified internal error */
  INTERNAL = 'INTERNAL',
  /** Input validation failed */
  VALIDATION = 'VALIDATION',
  /** Requested resource was not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Operation not authorized */
  UNAUTHORIZED = 'UNAUTHORIZED',
  /** Operation exceeded its time limit */
  TIMEOUT = 'TIMEOUT',
  /** A registered plugin threw an error */
  PLUGIN_ERROR = 'PLUGIN_ERROR',
  /** An agent failed to complete its task */
  AGENT_ERROR = 'AGENT_ERROR',
  /** The WRFC state machine encountered an error */
  WRFC_ERROR = 'WRFC_ERROR',
}

// ---------------------------------------------------------------------------
// Error category
// ---------------------------------------------------------------------------

/** Broad category of a runtime error, used for routing and logging */
export type ErrorCategory =
  | 'tool_failure'
  | 'agent_failure'
  | 'build_error'
  | 'test_failure'
  | 'validation_error'
  | 'external_error';

// ---------------------------------------------------------------------------
// GoodVibes error type
// ---------------------------------------------------------------------------

/**
 * The standard error envelope used throughout the GoodVibes ACP runtime.
 * Implementations should create plain objects conforming to this type —
 * NOT subclass Error (L0 is runtime-code free).
 */
export type GoodVibesError = {
  /** Machine-readable error code */
  code: ErrorCode;
  /** Broad category for routing and aggregation */
  category: ErrorCategory;
  /** Human-readable error message */
  message: string;
  /** Optional additional structured detail */
  details?: Record<string, unknown>;
  /** Whether the operation may be retried */
  recoverable: boolean;
};

// ---------------------------------------------------------------------------
// ACP wire error codes (JSON-RPC)
// ---------------------------------------------------------------------------

/**
 * JSON-RPC error codes used when sending errors over the ACP wire.
 * Mirrors the standard JSON-RPC 2.0 spec codes plus application-specific ranges.
 */
export type ACPErrorCode =
  | -32700 // Parse error
  | -32600 // Invalid request
  | -32601 // Method not found
  | -32602 // Invalid params (validation errors)
  | -32603 // Internal error
  | -32000; // Application error (plugin errors, agent errors)
