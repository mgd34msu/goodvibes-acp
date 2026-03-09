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
 * ACP spec-defined values (KB-05): 'shell' | 'file_write' | 'file_delete' | 'network' | 'browser'
 * The protocol allows custom string types — this union is intentionally open.
 *
 * GoodVibes internal extensions (not ACP spec): '_goodvibes/mcp' | '_goodvibes/extension'
 */
export type PermissionType =
  | 'shell'
  | 'file_write'
  | 'file_delete'
  | 'network'
  | 'browser'
  | '_goodvibes/mcp'
  | '_goodvibes/extension'
  | (string & {});

// ---------------------------------------------------------------------------
// PermissionRequest
// ---------------------------------------------------------------------------

/**
 * Kind of permission option (controls grant duration/scope).
 * Maps to the ACP SDK `PermissionOptionKind` type (KB-09).
 */
export type PermissionOptionKind = 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';

/**
 * A selectable option presented to the user in an ACP permission request.
 * Maps to the ACP SDK `PermissionOption` type (KB-09 lines 147-165).
 *
 * @remarks The previous shape `{ id, label }` was incorrect. The SDK uses
 * `{ optionId, kind, name }` — this type has been updated for SDK alignment.
 */
export type PermissionOption = {
  /** Option identifier used to correlate the user's response */
  optionId: string;
  /** Determines grant duration/scope */
  kind: PermissionOptionKind;
  /** Human-readable label shown to the user */
  name: string;
};

/**
 * Request payload passed to PermissionGate.check().
 * Describes the action that needs approval.
 *
 * Internal abstraction over the ACP SDK wire format. The `toolCall` wrapper
 * and `options: PermissionOption[]` fields model the ACP SDK shape
 * (KB-09 lines 147-165). The `PermissionGate` class constructs the full
 * SDK request from these fields.
 */
export type PermissionRequest = {
  /** Categorizes the action (maps to ACP permission.type) */
  type: PermissionType;
  /**
   * ACP session identifier.
   * @remarks This field is IGNORED at runtime — `PermissionGate` always uses the
   * `sessionId` injected via its constructor. The field is retained for interface
   * completeness but callers should not rely on it being read.
   */
  sessionId?: string;
  /** Optional: tool name when type is '_goodvibes/mcp' */
  toolName?: string;
  /** The UUID from the preceding tool_call update; used as toolCallId in ACP permission requests */
  toolCallId?: string;
  /** Short label for UI display */
  title: string;
  /** Full description of what will happen */
  description: string;
  /**
   * Structured tool call context for the ACP permission wire format.
   * When present, used to construct the ACP SDK `toolCall` object.
   * Maps to KB-09 lines 147-165: `{ title: string, [tool-specific fields] }`
   */
  toolCall?: Record<string, unknown>;
  /**
   * Selectable options presented to the user (ACP option-selection pattern).
   * When omitted, PermissionGate generates default allow/deny options.
   * Maps to KB-09 `options: PermissionOption[]`.
   */
  options?: PermissionOption[];
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
