/**
 * @module types/permissions
 * @layer L0 — pure types, no runtime code
 *
 * Defines types for the ACP permission gate system.
 * Permissions gate tool execution — the agent pauses and asks the client
 * (which presents to the user) whether a sensitive action is allowed.
 */

// ---------------------------------------------------------------------------
// PermissionType
// ---------------------------------------------------------------------------

/**
 * Categories of actions that can be gated by the permission system.
 * Maps to ACP's `permission.type` string field on the wire.
 *
 * ACP spec-defined values: 'fs' | 'shell' | 'mcp' | 'extension'
 */
export type PermissionType = 'fs' | 'shell' | 'mcp' | 'extension';

// ---------------------------------------------------------------------------
// PermissionRequest
// ---------------------------------------------------------------------------

/**
 * Request payload passed to PermissionGate.check().
 * Describes the action that needs approval.
 */
export type PermissionRequest = {
  /** Categorizes the action (maps to ACP permission.type) */
  type: PermissionType;
  /** ACP session identifier — required on the wire, optional for internal callers */
  sessionId?: string;
  /** Optional: tool name when type is 'mcp' */
  toolName?: string;
  /** Short label for UI display */
  title: string;
  /** Full description of what will happen */
  description: string;
  /** Optional extensibility metadata (use instead of arguments for tool input preview) */
  _meta?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// PermissionResult
// ---------------------------------------------------------------------------

/** The outcome of a permission check. */
export type PermissionResult = {
  /** True when the action was approved, false when denied. */
  granted: boolean;
  /** Optional explanation, present when denied */
  reason?: string;
};

// ---------------------------------------------------------------------------
// PermissionPolicy
// ---------------------------------------------------------------------------

/**
 * Policy configuration for a PermissionGate instance.
 * Drives automatic approval/denial before falling back to client prompting.
 */
export type PermissionPolicy = {
  /** Permission types that are auto-approved without prompting the client */
  autoApprove: PermissionType[];
  /** Permission types that are always denied without prompting the client */
  alwaysDeny: PermissionType[];
  /** Whether to prompt the client for types not in either list (default: true) */
  promptForUnknown: boolean;
};
