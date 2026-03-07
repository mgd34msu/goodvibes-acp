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
 */
export type PermissionType =
  | 'tool_call'
  | 'file_write'
  | 'file_read'
  | 'command_execute'
  | 'network_access';

// ---------------------------------------------------------------------------
// PermissionStatus
// ---------------------------------------------------------------------------

/** Result of a permission check — granted or denied. */
export type PermissionStatus = 'granted' | 'denied';

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
  /** Optional: tool name when type is 'tool_call' */
  toolName?: string;
  /** Short label for UI display */
  title: string;
  /** Full description of what will happen */
  description: string;
  /** Optional structured arguments preview */
  arguments?: Record<string, unknown>;
  /** Optional extensibility metadata */
  _meta?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// PermissionResult
// ---------------------------------------------------------------------------

/** The outcome of a permission check. */
export type PermissionResult = {
  status: PermissionStatus;
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
